-- Stage 1F: ephemeral HTC staff support context for customer portal viewing.
-- Bounded retention (TTL rows only) — not a page-view / activity feed.
-- Does not replace customer auth.uid(); HQ staff keep their own identity.

create table if not exists public.htc_support_context (
  user_id uuid primary key references auth.users (id) on delete cascade,
  portal text not null check (portal in ('venue', 'client', 'vendor')),
  venue_id uuid references public.venues (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  vendor_id uuid references public.vendors (id) on delete cascade,
  mode text not null check (mode in ('read', 'assist')),
  actor_staff_email text,
  relationship_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint htc_support_context_target_chk check (
    (portal = 'venue' and venue_id is not null)
    or (portal = 'client' and client_id is not null and venue_id is not null)
    or (portal = 'vendor' and vendor_id is not null)
  )
);

create index if not exists htc_support_context_expires_idx
  on public.htc_support_context (expires_at);

alter table public.htc_support_context enable row level security;

drop policy if exists "htc_support_context_select_own" on public.htc_support_context;
create policy "htc_support_context_select_own"
  on public.htc_support_context for select to authenticated
  using (user_id = auth.uid() and expires_at > now());

-- No insert/update/delete for authenticated — service role / security definer RPCs only.

create or replace function public.htc_purge_expired_support_context()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.htc_support_context where expires_at <= now();
$$;

create or replace function public.htc_support_mode()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mode text;
begin
  if uid is null then
    return null;
  end if;
  perform public.htc_purge_expired_support_context();
  select c.mode into v_mode
  from public.htc_support_context c
  where c.user_id = uid
    and c.expires_at > now()
  limit 1;
  return v_mode;
end;
$$;

create or replace function public.htc_active_support_venue_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_venue uuid;
begin
  if uid is null then
    return null;
  end if;
  if not public.is_hq_admin() then
    return null;
  end if;
  perform public.htc_purge_expired_support_context();
  select c.venue_id into v_venue
  from public.htc_support_context c
  where c.user_id = uid
    and c.expires_at > now()
    and c.venue_id is not null
  limit 1;
  return v_venue;
end;
$$;

create or replace function public.htc_start_support_context(
  p_portal text,
  p_mode text,
  p_venue_id uuid default null,
  p_client_id uuid default null,
  p_vendor_id uuid default null,
  p_relationship_id text default null,
  p_ttl_seconds int default 7200
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_ttl int := greatest(60, least(coalesce(p_ttl_seconds, 7200), 28800));
  v_exp timestamptz := now() + make_interval(secs => v_ttl);
  v_email text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if not public.is_hq_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_hq_admin');
  end if;
  if p_mode not in ('read', 'assist') then
    return jsonb_build_object('ok', false, 'error', 'invalid_mode');
  end if;
  if p_portal not in ('venue', 'client', 'vendor') then
    return jsonb_build_object('ok', false, 'error', 'invalid_portal');
  end if;
  if p_portal = 'venue' and p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'venue_required');
  end if;
  if p_portal = 'client' and (p_client_id is null or p_venue_id is null) then
    return jsonb_build_object('ok', false, 'error', 'client_and_venue_required');
  end if;
  if p_portal = 'vendor' and p_vendor_id is null then
    return jsonb_build_object('ok', false, 'error', 'vendor_required');
  end if;

  select email into v_email from auth.users where id = uid;

  insert into public.htc_support_context (
    user_id, portal, venue_id, client_id, vendor_id, mode,
    actor_staff_email, relationship_id, expires_at, created_at
  ) values (
    uid, p_portal, p_venue_id, p_client_id, p_vendor_id, p_mode,
    v_email, p_relationship_id, v_exp, now()
  )
  on conflict (user_id) do update set
    portal = excluded.portal,
    venue_id = excluded.venue_id,
    client_id = excluded.client_id,
    vendor_id = excluded.vendor_id,
    mode = excluded.mode,
    actor_staff_email = excluded.actor_staff_email,
    relationship_id = excluded.relationship_id,
    expires_at = excluded.expires_at,
    created_at = now();

  return jsonb_build_object(
    'ok', true,
    'portal', p_portal,
    'mode', p_mode,
    'venue_id', p_venue_id,
    'client_id', p_client_id,
    'vendor_id', p_vendor_id,
    'expires_at', v_exp
  );
end;
$$;

create or replace function public.htc_end_support_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  delete from public.htc_support_context where user_id = uid;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.htc_get_support_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.htc_support_context%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'active', false);
  end if;
  perform public.htc_purge_expired_support_context();
  select * into r from public.htc_support_context where user_id = uid and expires_at > now();
  if not found then
    return jsonb_build_object('ok', true, 'active', false);
  end if;
  return jsonb_build_object(
    'ok', true,
    'active', true,
    'portal', r.portal,
    'mode', r.mode,
    'venue_id', r.venue_id,
    'client_id', r.client_id,
    'vendor_id', r.vendor_id,
    'relationship_id', r.relationship_id,
    'actor_staff_email', r.actor_staff_email,
    'expires_at', r.expires_at
  );
end;
$$;

grant execute on function public.htc_purge_expired_support_context() to authenticated, service_role;
grant execute on function public.htc_support_mode() to authenticated, anon;
grant execute on function public.htc_active_support_venue_id() to authenticated, anon;
grant execute on function public.htc_start_support_context(text, text, uuid, uuid, uuid, text, int) to authenticated, service_role;
grant execute on function public.htc_end_support_context() to authenticated, service_role;
grant execute on function public.htc_get_support_context() to authenticated, service_role;

-- Prefer ephemeral support venue context for HQ admins over staff membership.
create or replace function public.current_user_venue_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_venue uuid;
  v_support uuid;
begin
  if uid is null then
    return null;
  end if;

  v_support := public.htc_active_support_venue_id();
  if v_support is not null then
    return v_support;
  end if;

  select c.active_venue_id into v_venue
  from public.venue_staff_active_context c
  where c.user_id = uid;

  if v_venue is null then
    return null;
  end if;

  if exists (
    select 1
    from public.venue_staff s
    where s.user_id = uid
      and s.venue_id = v_venue
      and s.is_active = true
      and s.accepted_at is not null
  ) then
    return v_venue;
  end if;

  return null;
end;
$$;

grant execute on function public.current_user_venue_id() to authenticated;

-- During read-only support, treat staff as a non-owner viewer role for role gates.
create or replace function public.current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_role text;
begin
  v_mode := public.htc_support_mode();
  if v_mode = 'read' then
    return 'viewer';
  end if;
  if v_mode = 'assist' then
    return 'owner';
  end if;

  select s.role into v_role
  from public.venue_staff s
  where s.user_id = auth.uid()
    and s.venue_id = public.current_user_venue_id()
    and s.accepted_at is not null
    and s.is_active = true;
  return v_role;
end;
$$;

grant execute on function public.current_user_role() to authenticated, anon;

notify pgrst, 'reload schema';
