-- ============================================================================
-- Floor Plans Phase 4 — real linked before/after room flips
--
-- Contract (v1.5 / F7 / C9 Phase 4):
-- * A flip is an explicit relationship between two distinct real floor_plan IDs.
-- * FP-SR / dual-zone starters / catalog metadata are never a link.
-- * Venue-only transition_notes; never exposed to couple portal APIs.
-- * Unlink deletes only this relationship row (and its notes); layouts remain.
-- * Link/unlink must not mutate layout contents, seating, setup membership,
--   preference, approval, operational, or sharing (enforced in application).
-- * One linked flip pair per event (unique event_id). Room (space_id) context
--   is read from the linked floor_plans; mismatch may warn in UI but does not
--   block linking (no hard same-room eligibility rule in this phase).
-- * Phase 5 booking-change / room-mismatch review flags are out of scope.
-- ============================================================================

create table if not exists public.event_floor_plan_flips (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  before_floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,
  after_floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,
  transition_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_floor_plan_flips_distinct_layouts check (
    before_floor_plan_id <> after_floor_plan_id
  ),
  constraint event_floor_plan_flips_one_per_event unique (event_id)
);

create index if not exists event_floor_plan_flips_venue
  on public.event_floor_plan_flips (venue_id);

create index if not exists event_floor_plan_flips_before
  on public.event_floor_plan_flips (before_floor_plan_id);

create index if not exists event_floor_plan_flips_after
  on public.event_floor_plan_flips (after_floor_plan_id);

create trigger event_floor_plan_flips_updated_at
  before update on public.event_floor_plan_flips
  for each row execute function public.set_updated_at();

comment on table public.event_floor_plan_flips is
  'Phase 4: explicit before/after layout link for venue staff planning. Not a timed/staffed auto-transition. transition_notes are venue-only.';

comment on column public.event_floor_plan_flips.transition_notes is
  'Venue-only turnover notes. Must never be returned by couple/portal APIs.';

create or replace function public.validate_event_floor_plan_flip()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_venue uuid;
  v_before record;
  v_after record;
begin
  select venue_id into v_event_venue from public.events where id = new.event_id;
  if v_event_venue is null then
    raise exception 'event_floor_plan_flips: event not found';
  end if;
  if v_event_venue <> new.venue_id then
    raise exception 'event_floor_plan_flips: venue_id must match event.venue_id';
  end if;

  if new.before_floor_plan_id = new.after_floor_plan_id then
    raise exception 'event_floor_plan_flips: before and after must be distinct layouts';
  end if;

  select id, venue_id, event_id into v_before
  from public.floor_plans
  where id = new.before_floor_plan_id;
  if v_before.id is null then
    raise exception 'event_floor_plan_flips: before layout not found';
  end if;
  if v_before.venue_id <> new.venue_id or v_before.event_id is distinct from new.event_id then
    raise exception 'event_floor_plan_flips: before layout must belong to the same event and venue';
  end if;

  select id, venue_id, event_id into v_after
  from public.floor_plans
  where id = new.after_floor_plan_id;
  if v_after.id is null then
    raise exception 'event_floor_plan_flips: after layout not found';
  end if;
  if v_after.venue_id <> new.venue_id or v_after.event_id is distinct from new.event_id then
    raise exception 'event_floor_plan_flips: after layout must belong to the same event and venue';
  end if;

  return new;
end;
$$;

drop trigger if exists event_floor_plan_flips_validate on public.event_floor_plan_flips;
create trigger event_floor_plan_flips_validate
  before insert or update on public.event_floor_plan_flips
  for each row execute function public.validate_event_floor_plan_flip();

alter table public.event_floor_plan_flips enable row level security;

drop policy if exists event_floor_plan_flips_all on public.event_floor_plan_flips;
create policy event_floor_plan_flips_all on public.event_floor_plan_flips
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_floor_plan_flips to authenticated;
