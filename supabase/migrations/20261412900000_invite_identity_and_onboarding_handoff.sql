-- Restore TR-G7 invite identity check into the current owner-promotion
-- accept_team_invitation, and add a trusted one-time venue onboarding handoff.
--
-- Does not change ordinary B_keep_valid / bootstrap classification.
-- Does not accept a client-supplied venue id as authorization.

-- ============================================================================
-- 1. accept_team_invitation — identity bound + owner-pending promotion
-- ============================================================================

create or replace function public.accept_team_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.venue_staff%rowtype;
  v_uid uuid := auth.uid();
  v_email text;
  v_invited_email text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_staff
  from public.venue_staff
  where invite_token = p_token
    and accepted_at  is null
    and is_active    = true;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  v_invited_email := lower(trim(coalesce(v_staff.email, '')));
  if v_invited_email = '' then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  select lower(trim(email)) into v_email
    from auth.users
   where id = v_uid;

  if v_email is null or v_email <> v_invited_email then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  update public.venue_staff
  set user_id      = v_uid,
      accepted_at  = now(),
      invite_token = null,
      is_owner     = case when owner_invite_pending then true else is_owner end,
      owner_invite_pending = false,
      access_title = case
        when owner_invite_pending and (access_title is null or access_title = 'staff')
          then 'administrator'
        else coalesce(access_title, 'staff')
      end,
      title_basis = case
        when owner_invite_pending then coalesce(nullif(title_basis, ''), 'administrator')
        else coalesce(title_basis, access_title, 'staff')
      end
  where id = v_staff.id
    and invite_token = p_token
    and accepted_at is null
  returning * into v_staff;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  if v_staff.is_owner and v_staff.user_id is not null then
    update public.venues
    set owner_user_id = v_staff.user_id
    where id = v_staff.venue_id
      and not exists (
        select 1 from public.venue_staff s
        where s.venue_id = v_staff.venue_id
          and s.user_id = public.venues.owner_user_id
          and s.is_owner = true
          and s.is_active = true
          and s.accepted_at is not null
      );
  end if;

  insert into public.venue_staff_active_context (user_id, active_venue_id, updated_at)
  values (v_uid, v_staff.venue_id, now())
  on conflict (user_id) do update
    set active_venue_id = excluded.active_venue_id,
        updated_at = now();

  return jsonb_build_object(
    'ok',      true,
    'venueId', v_staff.venue_id,
    'role',    v_staff.role,
    'isOwner', v_staff.is_owner,
    'accessTitle', v_staff.access_title
  );

exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'already_a_member');
end;
$$;

revoke all on function public.accept_team_invitation(uuid) from public;
grant execute on function public.accept_team_invitation(uuid) to authenticated;

-- ============================================================================
-- 2. One-time onboarding venue handoff (purchase → login)
-- ============================================================================

create table if not exists public.venue_onboarding_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  intended_email text not null,
  venue_id uuid not null references public.venues (id) on delete cascade,
  origin text not null check (origin in ('purchase_activation', 'owner_invitation')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists venue_onboarding_handoffs_open_user
  on public.venue_onboarding_handoffs (user_id, created_at desc)
  where consumed_at is null;

alter table public.venue_onboarding_handoffs enable row level security;

revoke all on public.venue_onboarding_handoffs from public;
revoke all on public.venue_onboarding_handoffs from anon;
revoke all on public.venue_onboarding_handoffs from authenticated;

create or replace function public.create_venue_onboarding_handoff(
  p_user_id uuid,
  p_intended_email text,
  p_venue_id uuid,
  p_origin text,
  p_ttl_minutes integer default 1440
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_id uuid;
begin
  if p_user_id is null or p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'handoff_required');
  end if;

  v_email := lower(trim(coalesce(p_intended_email, '')));
  if v_email = '' or v_email not like '%@%' then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;

  if p_origin is null or p_origin not in ('purchase_activation', 'owner_invitation') then
    return jsonb_build_object('ok', false, 'error', 'origin_required');
  end if;

  if coalesce(p_ttl_minutes, 0) <= 0 or p_ttl_minutes > 10080 then
    return jsonb_build_object('ok', false, 'error', 'ttl_invalid');
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;

  if not exists (select 1 from public.venues where id = p_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'venue_not_found');
  end if;

  if not exists (
    select 1
    from public.venue_staff s
    where s.user_id = p_user_id
      and s.venue_id = p_venue_id
      and s.is_active = true
      and s.accepted_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_a_member');
  end if;

  update public.venue_onboarding_handoffs
     set consumed_at = now()
   where user_id = p_user_id
     and consumed_at is null;

  insert into public.venue_onboarding_handoffs (
    user_id, intended_email, venue_id, origin, expires_at
  ) values (
    p_user_id, v_email, p_venue_id, p_origin, now() + make_interval(mins => p_ttl_minutes)
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.create_venue_onboarding_handoff(uuid, text, uuid, text, integer) from public;
grant execute on function public.create_venue_onboarding_handoff(uuid, text, uuid, text, integer) to service_role;

create or replace function public.consume_venue_onboarding_handoff()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_row public.venue_onboarding_handoffs%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select lower(trim(email)) into v_email
    from auth.users
   where id = v_uid;

  if v_email is null or v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  select * into v_row
    from public.venue_onboarding_handoffs
   where user_id = v_uid
     and consumed_at is null
     and expires_at > now()
   order by created_at desc
   for update
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_handoff');
  end if;

  if lower(trim(v_row.intended_email)) <> v_email then
    return jsonb_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  if not exists (
    select 1
    from public.venue_staff s
    where s.user_id = v_uid
      and s.venue_id = v_row.venue_id
      and s.is_active = true
      and s.accepted_at is not null
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_a_member');
  end if;

  update public.venue_onboarding_handoffs
     set consumed_at = now()
   where id = v_row.id
     and consumed_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_consumed');
  end if;

  insert into public.venue_staff_active_context (user_id, active_venue_id, updated_at)
  values (v_uid, v_row.venue_id, now())
  on conflict (user_id) do update
    set active_venue_id = excluded.active_venue_id,
        updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'venueId', v_row.venue_id,
    'origin', v_row.origin
  );
end;
$$;

revoke all on function public.consume_venue_onboarding_handoff() from public;
grant execute on function public.consume_venue_onboarding_handoff() to authenticated;
