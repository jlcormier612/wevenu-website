-- ============================================================================
-- Team & Permissions — access titles, multi-owner, last-owner safety, backfill
--
-- Wave 1 library becomes persisted. Owner ≠ access title. Multiple Owners.
-- account.billing is delegable (app layer); ownership-only remains non-delegable.
-- Wave 2 active venue context is unchanged.
-- ============================================================================

-- ── 1. New membership columns ─────────────────────────────────────────────────

alter table public.venue_staff
  add column if not exists access_title text,
  add column if not exists title_basis text,
  add column if not exists capability_overrides jsonb not null default '{}'::jsonb,
  add column if not exists owner_invite_pending boolean not null default false;

comment on column public.venue_staff.access_title is
  'Wave 1 access title: administrator|manager|coordinator|staff|view_only|custom. Independent of is_owner.';
comment on column public.venue_staff.title_basis is
  'Basis preset when access_title = custom; otherwise mirrors access_title for non-custom titles.';
comment on column public.venue_staff.capability_overrides is
  'Sparse capability overrides (json object of capability_key → boolean). Ownership-only keys forbidden.';
comment on column public.venue_staff.owner_invite_pending is
  'True when invited as Owner but not yet accepted; is_owner stays false until accept.';
comment on column public.venue_staff.title is
  'Free-text job title (e.g. General Manager). Not the access title.';

-- ── 2. Backfill from legacy role ──────────────────────────────────────────────

update public.venue_staff
set
  access_title = case
    when role = 'owner' then 'administrator'
    when role = 'manager' then 'manager'
    when role = 'coordinator' then 'coordinator'
    when role = 'staff' then 'staff'
    else 'staff'
  end,
  title_basis = case
    when role = 'owner' then 'administrator'
    when role = 'manager' then 'manager'
    when role = 'coordinator' then 'coordinator'
    when role = 'staff' then 'staff'
    else 'staff'
  end,
  capability_overrides = coalesce(capability_overrides, '{}'::jsonb),
  -- Preserve existing is_owner; owner role rows must be owners
  is_owner = case when role = 'owner' then true else is_owner end
where access_title is null;

alter table public.venue_staff
  alter column access_title set not null;

alter table public.venue_staff
  drop constraint if exists venue_staff_access_title_check;

alter table public.venue_staff
  add constraint venue_staff_access_title_check
  check (access_title = any (array[
    'administrator', 'manager', 'coordinator', 'staff', 'view_only', 'custom'
  ]));

alter table public.venue_staff
  drop constraint if exists venue_staff_title_basis_check;

alter table public.venue_staff
  add constraint venue_staff_title_basis_check
  check (
    title_basis is null
    or title_basis = any (array[
      'administrator', 'manager', 'coordinator', 'staff', 'view_only'
    ])
  );

alter table public.venue_staff
  drop constraint if exists venue_staff_custom_requires_basis;

alter table public.venue_staff
  add constraint venue_staff_custom_requires_basis
  check (
    (access_title <> 'custom' and (title_basis is null or title_basis = access_title))
    or (access_title = 'custom' and title_basis is not null)
  );

-- Non-custom rows: keep title_basis aligned with access_title
update public.venue_staff
set title_basis = access_title
where access_title <> 'custom'
  and (title_basis is distinct from access_title);

alter table public.venue_staff
  alter column title_basis set not null;

-- ── 3. Multi-owner: drop singular Owner unique index ──────────────────────────

drop index if exists public.venue_staff_one_owner;

-- Partial unique: at most one *pending* Owner invite per email per venue
-- (accepted Owners identified by is_owner; pending by owner_invite_pending)
create unique index if not exists venue_staff_one_pending_owner_invite
  on public.venue_staff (venue_id)
  where owner_invite_pending = true and is_active = true;

-- ── 4. Last-Owner protection ──────────────────────────────────────────────────

create or replace function public.venue_active_owner_count(p_venue_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.venue_staff
  where venue_id = p_venue_id
    and is_owner = true
    and is_active = true
    and accepted_at is not null;
$$;

grant execute on function public.venue_active_owner_count(uuid) to authenticated, service_role;

create or replace function public.enforce_last_owner_invariant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_remaining integer;
  v_bypass text;
begin
  -- Optional transactional bypass for atomic transfer (set_config in same txn)
  v_bypass := current_setting('htc.allow_last_owner_change', true);
  if v_bypass = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_owner and old.is_active and old.accepted_at is not null then
      v_remaining := public.venue_active_owner_count(old.venue_id)
        - 1; -- this row still counted until delete completes; recount excluding it
      select count(*)::integer into v_remaining
      from public.venue_staff
      where venue_id = old.venue_id
        and is_owner = true
        and is_active = true
        and accepted_at is not null
        and id is distinct from old.id;
      if v_remaining < 1 then
        raise exception 'last_owner_protected'
          using errcode = 'P0001',
            message = 'Cannot remove the last Owner of a venue.';
      end if;
    end if;
    return old;
  end if;

  -- UPDATE: losing owner status / deactivating / un-accepting
  if old.is_owner
     and old.is_active
     and old.accepted_at is not null
     and (
       new.is_owner = false
       or new.is_active = false
       or new.accepted_at is null
     )
  then
    select count(*)::integer into v_remaining
    from public.venue_staff
    where venue_id = old.venue_id
      and is_owner = true
      and is_active = true
      and accepted_at is not null
      and id is distinct from old.id;
    if v_remaining < 1 then
      raise exception 'last_owner_protected'
        using errcode = 'P0001',
          message = 'Cannot remove or deactivate the last Owner of a venue.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists venue_staff_last_owner_guard on public.venue_staff;
create trigger venue_staff_last_owner_guard
  before update or delete on public.venue_staff
  for each row
  execute function public.enforce_last_owner_invariant();

-- Forbid ownership-only keys as true in capability_overrides
create or replace function public.enforce_capability_override_denylist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
  denied text[] := array[
    'ownership.add_owner',
    'ownership.remove_owner',
    'ownership.transfer',
    'ownership.close_venue'
  ];
begin
  if new.capability_overrides is null then
    new.capability_overrides := '{}'::jsonb;
  end if;
  foreach k in array denied
  loop
    if (new.capability_overrides ->> k) = 'true' then
      raise exception 'ownership_only_override_forbidden'
        using errcode = 'P0001',
          message = format('Capability %s cannot be granted through overrides.', k);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists venue_staff_override_denylist on public.venue_staff;
create trigger venue_staff_override_denylist
  before insert or update of capability_overrides on public.venue_staff
  for each row
  execute function public.enforce_capability_override_denylist();

-- ── 5. Active-venue ownership/capability helpers (Wave 2 scoped) ───────────────

create or replace function public.current_user_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.venue_staff s
    where s.user_id = auth.uid()
      and s.venue_id = public.current_user_venue_id()
      and s.is_owner = true
      and s.is_active = true
      and s.accepted_at is not null
  );
$$;

grant execute on function public.current_user_is_owner() to authenticated, anon;

create or replace function public.current_user_access_title()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select s.access_title
  from public.venue_staff s
  where s.user_id = auth.uid()
    and s.venue_id = public.current_user_venue_id()
    and s.accepted_at is not null
    and s.is_active = true
  limit 1;
$$;

grant execute on function public.current_user_access_title() to authenticated, anon;

-- Compatibility: map access_title → legacy role string for existing RLS.
-- Owners keep role='owner'. Non-owner administrators map to manager for RLS.
create or replace function public.legacy_role_for_access(
  p_access_title text,
  p_is_owner boolean
)
returns text
language sql
immutable
as $$
  select case
    when p_is_owner then 'owner'
    when p_access_title = 'administrator' then 'manager'
    when p_access_title = 'manager' then 'manager'
    when p_access_title = 'coordinator' then 'coordinator'
    when p_access_title in ('staff', 'view_only') then 'staff'
    when p_access_title = 'custom' then 'staff'
    else 'staff'
  end;
$$;

-- Keep venue_staff.role dual-written from access fields for transitional RLS.
create or replace function public.sync_venue_staff_legacy_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.role := public.legacy_role_for_access(new.access_title, new.is_owner);
  return new;
end;
$$;

drop trigger if exists venue_staff_sync_legacy_role on public.venue_staff;
create trigger venue_staff_sync_legacy_role
  before insert or update of access_title, is_owner on public.venue_staff
  for each row
  execute function public.sync_venue_staff_legacy_role();

-- Re-sync all rows once after backfill
update public.venue_staff
set role = public.legacy_role_for_access(access_title, is_owner);

-- ── 6. Atomic ownership transfer ──────────────────────────────────────────────

create or replace function public.transfer_venue_ownership(
  p_from_staff_id uuid,
  p_to_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from public.venue_staff%rowtype;
  v_to public.venue_staff%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_from from public.venue_staff where id = p_from_staff_id for update;
  select * into v_to from public.venue_staff where id = p_to_staff_id for update;

  if not found or v_from.venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'from_not_found');
  end if;
  if v_to.id is null then
    return jsonb_build_object('ok', false, 'error', 'to_not_found');
  end if;
  if v_from.venue_id <> v_to.venue_id then
    return jsonb_build_object('ok', false, 'error', 'venue_mismatch');
  end if;
  if v_from.venue_id is distinct from public.current_user_venue_id() then
    return jsonb_build_object('ok', false, 'error', 'wrong_venue');
  end if;
  if not public.current_user_is_owner() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if not v_from.is_owner or not v_from.is_active then
    return jsonb_build_object('ok', false, 'error', 'from_not_owner');
  end if;
  if not v_to.is_active or v_to.accepted_at is null then
    return jsonb_build_object('ok', false, 'error', 'to_not_active');
  end if;

  perform set_config('htc.allow_last_owner_change', '1', true);

  update public.venue_staff
  set is_owner = true,
      owner_invite_pending = false
  where id = v_to.id;

  update public.venue_staff
  set is_owner = false
  where id = v_from.id;

  -- Keep venues.owner_user_id as account contact pointer when possible
  if v_to.user_id is not null then
    update public.venues
    set owner_user_id = v_to.user_id
    where id = v_from.venue_id;
  end if;

  perform set_config('htc.allow_last_owner_change', '0', true);

  return jsonb_build_object('ok', true, 'venueId', v_from.venue_id);
end;
$$;

grant execute on function public.transfer_venue_ownership(uuid, uuid) to authenticated;

-- ── 7. Enrollment: purchaser identity + invited Owner fields ──────────────────

alter table public.venue_enrollments
  add column if not exists purchaser_is_owner boolean,
  add column if not exists invited_owner_name text,
  add column if not exists invited_owner_email text;

comment on column public.venue_enrollments.purchaser_is_owner is
  'Null until activation: true = purchaser is Owner; false = setup on behalf (Administrator + billing).';
comment on column public.venue_enrollments.invited_owner_name is
  'When purchaser_is_owner = false, the venue Owner to invite.';
comment on column public.venue_enrollments.invited_owner_email is
  'When purchaser_is_owner = false, Owner invite email.';
