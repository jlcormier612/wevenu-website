-- ============================================================================
-- Calendar Slice 2A.1 — Venue appointment catalog foundation.
--
-- venue_schedule_item_types = configuration only (which offerings a venue
-- uses). calendar_blocks remains the scheduled-item system of record.
--
-- Adds closed type value 'custom' (not free-form). Snapshots
-- blocks_availability onto each calendar_blocks row. Event covering then
-- requires blocks_availability = true. Tour closing is unchanged
-- (blocked_time / wedding_event_booking / private_event only).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Catalog table
-- ---------------------------------------------------------------------------

create table public.venue_schedule_item_types (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  source text not null check (source in ('builtin', 'custom')),
  builtin_key text null,
  custom_key text null,
  label text not null,
  enabled boolean not null default true,
  blocks_availability boolean not null,
  group_key text not null check (group_key in ('meetings', 'availability', 'other')),
  sort_order integer not null default 0,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint venue_schedule_item_types_shape_check check (
    (
      source = 'builtin'
      and builtin_key is not null
      and custom_key is null
      and archived_at is null
    )
    or (
      source = 'custom'
      and custom_key is not null
      and builtin_key is null
    )
  ),

  constraint venue_schedule_item_types_builtin_key_check check (
    builtin_key is null
    or builtin_key in (
      'consultation',
      'client_meeting',
      'walkthrough',
      'vendor_meeting',
      'personal_appointment',
      'blocked_time',
      'other',
      'tasting'
    )
  ),

  -- blocked_time is always a safe generic blocking capability.
  constraint venue_schedule_item_types_blocked_time_enabled_check check (
    builtin_key is distinct from 'blocked_time'
    or enabled = true
  )
);

-- Composite uniqueness target for same-venue FK from calendar_blocks.
create unique index venue_schedule_item_types_id_venue_uidx
  on public.venue_schedule_item_types (id, venue_id);

create unique index venue_schedule_item_types_builtin_uidx
  on public.venue_schedule_item_types (venue_id, builtin_key)
  where builtin_key is not null;

create unique index venue_schedule_item_types_active_custom_uidx
  on public.venue_schedule_item_types (venue_id, custom_key)
  where source = 'custom' and archived_at is null and custom_key is not null;

create index venue_schedule_item_types_venue_idx
  on public.venue_schedule_item_types (venue_id, sort_order);

comment on table public.venue_schedule_item_types is
  'Venue appointment catalog (configuration). Scheduled instances remain in calendar_blocks.';

-- Cap: 20 active (non-archived) custom types per venue.
create or replace function public.venue_schedule_item_types_enforce_custom_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if NEW.source is distinct from 'custom' or NEW.archived_at is not null then
    return NEW;
  end if;
  select count(*)::integer into v_count
  from public.venue_schedule_item_types t
  where t.venue_id = NEW.venue_id
    and t.source = 'custom'
    and t.archived_at is null
    and (TG_OP = 'INSERT' or t.id is distinct from NEW.id);
  if v_count >= 20 then
    raise exception 'A venue may have at most 20 active custom schedule item types.'
      using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

create trigger venue_schedule_item_types_custom_cap
  before insert or update on public.venue_schedule_item_types
  for each row
  execute function public.venue_schedule_item_types_enforce_custom_cap();

create or replace function public.venue_schedule_item_types_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger venue_schedule_item_types_updated_at
  before update on public.venue_schedule_item_types
  for each row
  execute function public.venue_schedule_item_types_set_updated_at();

-- Builtin rows are never hard-deleted.
create or replace function public.venue_schedule_item_types_prevent_builtin_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if OLD.source = 'builtin' then
    raise exception 'Builtin schedule item types cannot be deleted.'
      using errcode = 'P0001';
  end if;
  return OLD;
end;
$$;

create trigger venue_schedule_item_types_no_builtin_delete
  before delete on public.venue_schedule_item_types
  for each row
  execute function public.venue_schedule_item_types_prevent_builtin_delete();

-- ---------------------------------------------------------------------------
-- 2. Seed helpers + backfill + venue-create trigger
-- ---------------------------------------------------------------------------

create or replace function public.seed_venue_schedule_item_types(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.venue_schedule_item_types (
    venue_id, source, builtin_key, label, enabled, blocks_availability, group_key, sort_order
  )
  values
    (p_venue_id, 'builtin', 'consultation',         'Consultation',          true,  true, 'meetings',     10),
    (p_venue_id, 'builtin', 'client_meeting',        'Client Meeting',        true,  true, 'meetings',     20),
    (p_venue_id, 'builtin', 'walkthrough',           'Walkthrough',           true,  true, 'meetings',     30),
    (p_venue_id, 'builtin', 'vendor_meeting',        'Vendor Meeting',        true,  true, 'meetings',     40),
    (p_venue_id, 'builtin', 'tasting',               'Tasting',               false, true, 'meetings',     50),
    (p_venue_id, 'builtin', 'personal_appointment',  'Personal Appointment',  true,  true, 'availability', 60),
    (p_venue_id, 'builtin', 'blocked_time',          'Blocked Time',          true,  true, 'availability', 70),
    (p_venue_id, 'builtin', 'other',                 'Other',                 true,  true, 'other',        80)
  on conflict (venue_id, builtin_key) where (builtin_key is not null)
  do nothing;
end;
$$;

revoke all on function public.seed_venue_schedule_item_types(uuid) from public;
grant execute on function public.seed_venue_schedule_item_types(uuid)
  to authenticated, service_role;

create or replace function public.venues_seed_schedule_item_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_venue_schedule_item_types(NEW.id);
  return NEW;
end;
$$;

drop trigger if exists venues_seed_schedule_item_types on public.venues;
create trigger venues_seed_schedule_item_types
  after insert on public.venues
  for each row
  execute function public.venues_seed_schedule_item_types();

-- Existing venues
do $$
declare
  r record;
begin
  for r in select id from public.venues loop
    perform public.seed_venue_schedule_item_types(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. calendar_blocks columns + closed CHECK + same-venue FK
-- ---------------------------------------------------------------------------

alter table public.calendar_blocks
  add column if not exists schedule_item_type_id uuid null,
  add column if not exists blocks_availability boolean;

-- Mandatory: existing rows stay protecting before covering logic changes.
update public.calendar_blocks
set blocks_availability = true
where blocks_availability is null;

alter table public.calendar_blocks
  alter column blocks_availability set default true,
  alter column blocks_availability set not null;

alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_type_check;

alter table public.calendar_blocks
  add constraint calendar_blocks_type_check
  check (type = any (array[
    'tour', 'consultation', 'client_meeting', 'walkthrough', 'tasting',
    'vendor_meeting', 'wedding_event_booking', 'private_event',
    'personal_appointment', 'blocked_time', 'other', 'custom'
  ]));

-- Same-venue integrity: (schedule_item_type_id, venue_id) → catalog (id, venue_id).
-- ON DELETE SET NULL preserves the calendar_blocks row if a custom catalog
-- entry is removed; type/title/blocks_availability remain.
alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_schedule_item_type_same_venue_fkey;

alter table public.calendar_blocks
  add constraint calendar_blocks_schedule_item_type_same_venue_fkey
  foreign key (schedule_item_type_id, venue_id)
  references public.venue_schedule_item_types (id, venue_id)
  on delete set null;

create index if not exists calendar_blocks_schedule_item_type_idx
  on public.calendar_blocks (schedule_item_type_id)
  where schedule_item_type_id is not null;

-- Non-destructive: link existing appointment builtin rows to catalog.
update public.calendar_blocks cb
set schedule_item_type_id = t.id
from public.venue_schedule_item_types t
where t.venue_id = cb.venue_id
  and t.source = 'builtin'
  and t.builtin_key = cb.type
  and cb.schedule_item_type_id is null
  and cb.type in (
    'consultation', 'client_meeting', 'walkthrough', 'vendor_meeting',
    'personal_appointment', 'blocked_time', 'other', 'tasting'
  );

comment on column public.calendar_blocks.schedule_item_type_id is
  'Optional link to venue_schedule_item_types. Configuration reference only; this row remains the scheduled-item SoR.';
comment on column public.calendar_blocks.blocks_availability is
  'Snapshot: whether this scheduled item occupies venue Event availability. Copied from catalog (or system rules) on create/type edit; not silently rewritten when catalog defaults change.';

-- ---------------------------------------------------------------------------
-- 4. Event covering requires blocks_availability = true
--    Tour covering (p_types set) unchanged — type filter only.
-- ---------------------------------------------------------------------------

create or replace function public.covering_calendar_block_title(
  p_venue_id uuid,
  p_range_start date,
  p_range_end date,
  p_window_start time,
  p_window_end time,
  p_types text[] default null
)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_title text;
begin
  select cb.title into v_title
  from public.calendar_blocks cb
  where cb.venue_id = p_venue_id
    and cb.start_date <= p_range_end
    and (
      (
        coalesce(cb.recurrence_rule, 'none') = 'none'
        and cb.end_date >= p_range_start
      )
      or (
        coalesce(cb.recurrence_rule, 'none') is distinct from 'none'
        and (
          cb.recurrence_ends_on is null
          or (cb.recurrence_ends_on + (cb.end_date - cb.start_date)) >= p_range_start
        )
      )
    )
    and (
      (
        p_types is null
        and cb.blocks_availability = true
      )
      or (
        p_types is not null
        and cb.type = any (p_types)
      )
    )
    and public.calendar_block_covers_interval(
      cb.start_date,
      cb.end_date,
      cb.is_all_day,
      cb.start_time,
      cb.end_time,
      cb.recurrence_rule,
      cb.recurrence_interval,
      cb.recurrence_ends_on,
      cb.recurrence_count,
      p_range_start,
      p_range_end,
      p_window_start,
      p_window_end
    )
  order by cb.start_date, cb.title
  limit 1;
  return v_title;
end;
$$;

comment on function public.covering_calendar_block_title(uuid, date, date, time, time, text[]) is
  'First calendar_blocks title covering a venue-local date range + clock window, including recurrence. p_types null = Event covering (blocks_availability=true only); otherwise type filter (Tours).';

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.venue_schedule_item_types enable row level security;

drop policy if exists venue_schedule_item_types_select on public.venue_schedule_item_types;
drop policy if exists venue_schedule_item_types_insert on public.venue_schedule_item_types;
drop policy if exists venue_schedule_item_types_update on public.venue_schedule_item_types;
drop policy if exists venue_schedule_item_types_delete on public.venue_schedule_item_types;

create policy venue_schedule_item_types_select on public.venue_schedule_item_types
  for select
  using (venue_id = public.current_user_venue_id());

create policy venue_schedule_item_types_insert on public.venue_schedule_item_types
  for insert
  with check (
    venue_id = public.current_user_venue_id()
    and public.current_user_role() in ('owner', 'manager')
  );

create policy venue_schedule_item_types_update on public.venue_schedule_item_types
  for update
  using (
    venue_id = public.current_user_venue_id()
    and public.current_user_role() in ('owner', 'manager')
  )
  with check (
    venue_id = public.current_user_venue_id()
    and public.current_user_role() in ('owner', 'manager')
  );

create policy venue_schedule_item_types_delete on public.venue_schedule_item_types
  for delete
  using (
    venue_id = public.current_user_venue_id()
    and public.current_user_role() in ('owner', 'manager')
  );

grant select, insert, update, delete on public.venue_schedule_item_types to authenticated;
grant select, insert, update, delete on public.venue_schedule_item_types to service_role;

notify pgrst, 'reload schema';
