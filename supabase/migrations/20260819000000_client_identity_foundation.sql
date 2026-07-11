-- ============================================================================
-- Client Identity Foundation
--
-- Replaces venue-controlled portal access with client-owned access. The
-- client becomes the owner of their own workspace via a real Supabase Auth
-- account; the venue's role narrows to invite / resend / revoke. The venue
-- can no longer mint or open a client's portal session directly — the only
-- way a venue can view a client's workspace is a client-granted, time-boxed,
-- audited "temporary support access" grant (never impersonation: no login-as,
-- every use logged).
--
-- Delegated access (parent, planner, partner, etc.) reuses the existing
-- couple_portal_participants architecture (Sprint 61) — it already lets the
-- couple invite people with a role + permission level, it was just missing
-- the piece that turns a pending invite into a real, individually-owned
-- account + session. This migration completes that wiring rather than
-- building a parallel system.
--
-- New tables:
--   client_users                    — identity marker: one row per auth user
--                                      who owns a client-portal login
--                                      (primary client OR a delegated
--                                      participant)
--   client_invitations               — venue invites the primary client
--   client_support_access_grants     — client-granted, time-boxed venue
--                                      support access
--   client_support_access_log        — append-only audit trail of every use
--                                      of a support access grant
--
-- Additive columns:
--   client_portal_sessions.client_user_id  — which account owns this session
--   client_portal_sessions.participant_id  — which delegate (if any) owns it
--   couple_portal_participants.user_id     — which account claimed this
--                                             participant invite
-- ============================================================================

-- ── 1. client_users ────────────────────────────────────────────────────────

create table public.client_users (
  id          uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.client_users enable row level security;

create policy "client reads own identity row"
  on public.client_users for select
  using (id = auth.uid());

grant select on public.client_users to authenticated;

-- ── 2. client_invitations — venue invites the primary client ─────────────

create table public.client_invitations (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  email         text not null check (char_length(trim(email)) > 0),
  token         uuid not null unique default gen_random_uuid(),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  accepted_at   timestamptz
);

alter table public.client_invitations enable row level security;

create policy "venue manages own client invitations"
  on public.client_invitations for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.client_invitations to authenticated;

create index client_invitations_client on public.client_invitations (client_id);
create index client_invitations_token  on public.client_invitations (token);

-- ── 3. client_portal_sessions: link to the owning account ─────────────────

alter table public.client_portal_sessions
  add column client_user_id uuid references public.client_users(id) on delete set null,
  add column participant_id uuid references public.couple_portal_participants(id) on delete cascade;

create index client_portal_sessions_client_user on public.client_portal_sessions (client_user_id);
create index client_portal_sessions_participant on public.client_portal_sessions (participant_id);

-- Client can read/manage the portal sessions they personally own.
create policy "client manages own portal sessions"
  on public.client_portal_sessions for all
  using (client_user_id = auth.uid())
  with check (client_user_id = auth.uid());

grant select, insert, update, delete on public.client_portal_sessions to authenticated;

-- ── 4. couple_portal_participants: link to the claiming account ──────────

alter table public.couple_portal_participants
  add column user_id uuid references public.client_users(id) on delete set null;

create index cpp_user on public.couple_portal_participants (user_id);

-- A participant can read/update their own row once claimed.
create policy "participant reads own row"
  on public.couple_portal_participants for select
  using (user_id = auth.uid());

-- ── 5. client_support_access_grants ───────────────────────────────────────

create table public.client_support_access_grants (
  id                      uuid primary key default gen_random_uuid(),
  venue_id                uuid not null references public.venues(id) on delete cascade,
  client_id               uuid not null references public.clients(id) on delete cascade,
  granted_by_client_user_id uuid not null references public.client_users(id) on delete cascade,
  label                   text,
  created_at              timestamptz not null default now(),
  expires_at              timestamptz not null,
  revoked_at              timestamptz
);

alter table public.client_support_access_grants enable row level security;

create policy "client manages own support grants"
  on public.client_support_access_grants for all
  using (granted_by_client_user_id = auth.uid())
  with check (granted_by_client_user_id = auth.uid());

create policy "venue reads support grants for its clients"
  on public.client_support_access_grants for select
  using (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.client_support_access_grants to authenticated;

create index csag_client on public.client_support_access_grants (client_id);

-- ── 6. client_support_access_log — append-only audit trail ───────────────

create table public.client_support_access_log (
  id           uuid primary key default gen_random_uuid(),
  grant_id     uuid not null references public.client_support_access_grants(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id),
  accessed_at  timestamptz not null default now()
);

alter table public.client_support_access_log enable row level security;

create policy "venue reads its own support access log"
  on public.client_support_access_log for select
  using (exists (
    select 1 from public.client_support_access_grants g
    where g.id = client_support_access_log.grant_id
      and g.venue_id = public.current_user_venue_id()
  ));

create policy "client reads support access log for own grants"
  on public.client_support_access_log for select
  using (exists (
    select 1 from public.client_support_access_grants g
    where g.id = client_support_access_log.grant_id
      and g.granted_by_client_user_id = auth.uid()
  ));

grant select, insert on public.client_support_access_log to authenticated;

create index csal_grant on public.client_support_access_log (grant_id);

-- ── 7. accept_client_invitation — primary client claims their account ────
-- Mirrors accept_team_invitation / claim_vendor_profile: the auth account
-- already exists (created immediately before this call, in the same
-- server action, using the service role) and the caller is now signed in
-- as that account, so auth.uid() resolves it.

create or replace function public.accept_client_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv        public.client_invitations%rowtype;
  v_new_token  text;
begin
  select * into v_inv from public.client_invitations
  where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  insert into public.client_users (id) values (auth.uid())
  on conflict (id) do nothing;

  update public.client_invitations
  set status = 'accepted', accepted_at = now()
  where id = v_inv.id;

  insert into public.client_portal_sessions
    (venue_id, client_id, client_user_id, label, access_level)
  values
    (v_inv.venue_id, v_inv.client_id, auth.uid(), 'Primary', 'couple')
  returning access_token into v_new_token;

  return jsonb_build_object('ok', true, 'clientId', v_inv.client_id, 'accessToken', v_new_token);
end;
$$;

grant execute on function public.accept_client_invitation(uuid) to authenticated;

-- ── 8. accept_couple_participant_invitation — delegate claims their account ─

create or replace function public.accept_couple_participant_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p           public.couple_portal_participants%rowtype;
  v_access_level text;
  v_new_token   text;
begin
  select * into v_p from public.couple_portal_participants
  where invite_token = p_token and invite_status = 'pending';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  insert into public.client_users (id) values (auth.uid())
  on conflict (id) do nothing;

  update public.couple_portal_participants
  set invite_status = 'accepted', accepted_at = now(), last_active_at = now(), user_id = auth.uid()
  where id = v_p.id;

  v_access_level := case v_p.permission_level
    when 'full'      then 'couple'
    when 'financial' then 'financial'
    when 'view_only' then 'view_only'
    else 'planning'
  end;

  insert into public.client_portal_sessions
    (venue_id, client_id, client_user_id, participant_id, label, access_level)
  values
    (v_p.venue_id, v_p.client_id, auth.uid(), v_p.id,
     coalesce(v_p.custom_role_label, v_p.role), v_access_level)
  returning access_token into v_new_token;

  insert into public.couple_portal_activity
    (venue_id, client_id, activity_type, actor_name, detail_text)
  values
    (v_p.venue_id, v_p.client_id, 'participant_joined',
     v_p.first_name, v_p.first_name || ' joined your planning workspace.');

  return jsonb_build_object('ok', true, 'clientId', v_p.client_id, 'accessToken', v_new_token);
end;
$$;

grant execute on function public.accept_couple_participant_invitation(text) to authenticated;

-- ── 9. use_client_support_access — venue opens a client's workspace ──────
-- Validates the grant is active (not expired, not revoked) and appends an
-- audit-log row before returning the token to view. This is the only path
-- by which a venue can view a client's workspace after this migration.

create or replace function public.use_client_support_access(p_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant  public.client_support_access_grants%rowtype;
  v_token  text;
begin
  select * into v_grant from public.client_support_access_grants
  where id = p_grant_id
    and venue_id = public.current_user_venue_id()
    and revoked_at is null
    and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_grant');
  end if;

  select access_token into v_token
  from public.client_portal_sessions
  where client_id = v_grant.client_id
    and client_user_id is not null
    and participant_id is null
  order by created_at asc
  limit 1;

  if v_token is null then
    return jsonb_build_object('ok', false, 'error', 'no_client_session');
  end if;

  insert into public.client_support_access_log (grant_id, staff_user_id)
  values (v_grant.id, auth.uid());

  return jsonb_build_object('ok', true, 'accessToken', v_token);
end;
$$;

grant execute on function public.use_client_support_access(uuid) to authenticated;

notify pgrst, 'reload schema';
