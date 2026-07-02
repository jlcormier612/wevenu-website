-- ============================================================================
-- Sprint 61: Couple Portal Collaboration & Ownership
--
-- The couple owns their planning workspace. They invite the people helping
-- them plan — family, wedding planner, maid of honor — and control what
-- each person can see and do.
--
-- The venue has oversight (sees who has access, sees activity signals) but
-- does not control the couple's private workspace.
--
-- Two new tables:
--   couple_portal_participants — people the couple has invited
--   couple_portal_activity     — lightweight collaborative activity feed
--
-- Ownership principle: scoped by client_id, not event_id.
-- Participants survive venue relationship changes.
-- ============================================================================

-- ── 1. couple_portal_participants ─────────────────────────────────────────────

create table public.couple_portal_participants (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,

  -- Identity
  first_name      text not null check (char_length(trim(first_name)) > 0),
  last_name       text,
  email           text not null check (char_length(trim(email)) > 0),

  -- Role: human-readable label only, not permissions
  role            text not null default 'friend' check (role in (
    'partner',
    'parent',
    'wedding_planner',
    'maid_of_honor',
    'best_man',
    'family_member',
    'friend',
    'custom'
  )),
  custom_role_label  text,

  -- Permission level: what they can access
  permission_level  text not null default 'planning' check (permission_level in (
    'full',      -- everything except venue administration
    'planning',  -- planning, website, guest list, personal to-dos
    'financial', -- payments and invoices only
    'website',   -- website editing and RSVP management only
    'view_only'  -- read-only across all couple-owned sections
  )),

  -- Notification preferences per participant
  notify_planning   boolean not null default true,
  notify_payments   boolean not null default false,
  notify_website    boolean not null default true,
  notify_rsvps      boolean not null default true,

  -- Invitation lifecycle
  invite_status   text not null default 'pending' check (invite_status in (
    'pending',   -- invitation sent, awaiting acceptance
    'accepted',  -- participant has joined
    'declined',  -- participant declined
    'revoked'    -- couple revoked access
  )),
  invite_token    text not null unique default gen_random_uuid()::text,
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  last_active_at  timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Venue oversight: can see who has access and roles (not content)
alter table public.couple_portal_participants enable row level security;

create policy "venue owner reads participants"
  on public.couple_portal_participants for select
  using (exists (
    select 1 from public.venues
    where id = couple_portal_participants.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.couple_portal_participants to authenticated;

create index cpp_client  on public.couple_portal_participants (client_id);
create index cpp_email   on public.couple_portal_participants (email);
create index cpp_token   on public.couple_portal_participants (invite_token);
create unique index cpp_client_email on public.couple_portal_participants (client_id, email);

-- ── 2. couple_portal_activity ─────────────────────────────────────────────────

create table public.couple_portal_activity (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,

  activity_type   text not null check (activity_type in (
    'participant_invited',
    'participant_joined',
    'participant_removed',
    'website_updated',
    'guest_added',
    'todo_completed',
    'task_completed',
    'rsvp_received'
  )),

  actor_name    text,        -- "Emily", "Ashley" — who triggered it
  detail_text   text not null, -- "Ashley joined your planning workspace."

  created_at    timestamptz not null default now()
);

-- Venue can see high-level activity signals (not private content)
alter table public.couple_portal_activity enable row level security;

create policy "venue owner reads activity"
  on public.couple_portal_activity for select
  using (exists (
    select 1 from public.venues
    where id = couple_portal_activity.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.couple_portal_activity to authenticated;

create index cpa_client on public.couple_portal_activity (client_id, created_at desc);

-- ── SECURITY DEFINER functions ────────────────────────────────────────────────

-- get_couple_participants: list participants + recent activity
create or replace function public.get_couple_participants(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',               p.id,
          'firstName',        p.first_name,
          'lastName',         p.last_name,
          'email',            p.email,
          'role',             p.role,
          'customRoleLabel',  p.custom_role_label,
          'permissionLevel',  p.permission_level,
          'notifyPlanning',   p.notify_planning,
          'notifyPayments',   p.notify_payments,
          'notifyWebsite',    p.notify_website,
          'notifyRsvps',      p.notify_rsvps,
          'inviteStatus',     p.invite_status,
          'invitedAt',        p.invited_at,
          'acceptedAt',       p.accepted_at
        )
        order by
          (p.invite_status = 'accepted') desc,
          p.accepted_at desc nulls last,
          p.invited_at desc
      )
      from public.couple_portal_participants p
      where p.client_id = v_session.client_id
        and p.venue_id  = v_session.venue_id
        and p.invite_status != 'revoked'
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           a.id,
          'activityType', a.activity_type,
          'actorName',    a.actor_name,
          'detailText',   a.detail_text,
          'createdAt',    a.created_at
        )
        order by a.created_at desc
      )
      from (
        select * from public.couple_portal_activity
        where client_id = v_session.client_id
          and venue_id  = v_session.venue_id
        order by created_at desc
        limit 8
      ) a
    ), '[]'::jsonb)
  );
end;
$$;

-- invite_couple_participant: couple invites a collaborator
create or replace function public.invite_couple_participant(
  p_token            text,
  p_email            text,
  p_first_name       text,
  p_last_name        text,
  p_role             text,
  p_custom_label     text,
  p_permission_level text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id      uuid;
  v_token   text;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  -- Only couple-level sessions can invite participants
  if v_session.access_level not in ('couple') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  insert into public.couple_portal_participants
    (venue_id, client_id, email, first_name, last_name,
     role, custom_role_label, permission_level, invite_status, invited_at)
  values
    (v_session.venue_id, v_session.client_id,
     lower(trim(p_email)), trim(p_first_name), nullif(trim(coalesce(p_last_name,'')), ''),
     coalesce(nullif(p_role,''), 'friend'), nullif(trim(coalesce(p_custom_label,'')), ''),
     coalesce(nullif(p_permission_level,''), 'planning'), 'pending', now())
  on conflict (client_id, email) do update
    set first_name        = trim(p_first_name),
        last_name         = nullif(trim(coalesce(p_last_name,'')), ''),
        role              = coalesce(nullif(p_role,''), 'friend'),
        custom_role_label = nullif(trim(coalesce(p_custom_label,'')), ''),
        permission_level  = coalesce(nullif(p_permission_level,''), 'planning'),
        invite_status     = 'pending',
        invite_token      = gen_random_uuid()::text,
        invited_at        = now(),
        updated_at        = now()
  returning id, invite_token into v_id, v_token;

  -- Log activity
  insert into public.couple_portal_activity
    (venue_id, client_id, activity_type, actor_name, detail_text)
  values
    (v_session.venue_id, v_session.client_id, 'participant_invited',
     trim(p_first_name),
     trim(p_first_name) || ' was invited to join your planning workspace.');

  return jsonb_build_object('ok', true, 'participantId', v_id, 'inviteToken', v_token);
end;
$$;

-- update_couple_participant: change role, permissions, or notification prefs
create or replace function public.update_couple_participant(
  p_token            text,
  p_participant_id   uuid,
  p_role             text,
  p_custom_label     text,
  p_permission_level text,
  p_notify_planning  boolean,
  p_notify_payments  boolean,
  p_notify_website   boolean,
  p_notify_rsvps     boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level not in ('couple') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  update public.couple_portal_participants
  set role              = coalesce(nullif(p_role,''), role),
      custom_role_label = case when p_role = 'custom' then nullif(trim(coalesce(p_custom_label,'')), '') else custom_role_label end,
      permission_level  = coalesce(nullif(p_permission_level,''), permission_level),
      notify_planning   = coalesce(p_notify_planning, notify_planning),
      notify_payments   = coalesce(p_notify_payments, notify_payments),
      notify_website    = coalesce(p_notify_website, notify_website),
      notify_rsvps      = coalesce(p_notify_rsvps, notify_rsvps),
      updated_at        = now()
  where id        = p_participant_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- remove_couple_participant: couple removes someone (sets revoked, preserves history)
create or replace function public.remove_couple_participant(p_token text, p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_name    text;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level not in ('couple') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  select first_name into v_name
  from public.couple_portal_participants
  where id = p_participant_id and client_id = v_session.client_id;

  update public.couple_portal_participants
  set invite_status = 'revoked', updated_at = now()
  where id        = p_participant_id
    and client_id = v_session.client_id
    and venue_id  = v_session.venue_id;

  if v_name is not null then
    insert into public.couple_portal_activity
      (venue_id, client_id, activity_type, actor_name, detail_text)
    values
      (v_session.venue_id, v_session.client_id, 'participant_removed',
       v_name, v_name || '''s access was removed from the planning workspace.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_couple_participants(text)                                                    to anon, authenticated;
grant execute on function public.invite_couple_participant(text, text, text, text, text, text, text)             to anon, authenticated;
grant execute on function public.update_couple_participant(text, uuid, text, text, text, boolean, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.remove_couple_participant(text, uuid)                                           to anon, authenticated;

notify pgrst, 'reload schema';
