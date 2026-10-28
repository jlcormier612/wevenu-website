-- ============================================================================
-- Floor Plans Phase 5 — booking-change review flags
--
-- Contract (v1.5 / F5 / C7 / D-TRIG-SET):
-- * T1 + T3 only. T2 setup-to-space deferred (no schema here).
-- * Flags require explicit layout.space_id or flip room snapshots.
-- * Clear review mutates flag state only — never seating/layouts/ops.
-- * Flip snapshot columns distinguish captured (incl. null rooms) from legacy.
-- ============================================================================

-- ── Flip room-relationship snapshot (T3) ─────────────────────────────────────
alter table public.event_floor_plan_flips
  add column if not exists recorded_before_space_id uuid
    references public.venue_spaces (id) on delete set null;

alter table public.event_floor_plan_flips
  add column if not exists recorded_after_space_id uuid
    references public.venue_spaces (id) on delete set null;

alter table public.event_floor_plan_flips
  add column if not exists room_snapshot_captured_at timestamptz;

comment on column public.event_floor_plan_flips.recorded_before_space_id is
  'Phase 5: layout-before space_id at link time (may be null). Only meaningful when room_snapshot_captured_at is set.';
comment on column public.event_floor_plan_flips.recorded_after_space_id is
  'Phase 5: layout-after space_id at link time (may be null). Only meaningful when room_snapshot_captured_at is set.';
comment on column public.event_floor_plan_flips.room_snapshot_captured_at is
  'Phase 5: non-null means snapshot was deliberately captured (even with null room IDs). Null = legacy flip — no T3.';

-- ── Review flags ─────────────────────────────────────────────────────────────
create table if not exists public.event_floor_plan_review_flags (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  target_kind text not null
    check (target_kind in ('layout', 'flip')),
  floor_plan_id uuid references public.floor_plans (id) on delete cascade,
  flip_id uuid references public.event_floor_plan_flips (id) on delete cascade,
  trigger_code text not null
    check (trigger_code in ('t1_booking_room', 't1_layout_room', 't3_flip_snapshot')),
  status text not null default 'open'
    check (status in ('open', 'cleared')),
  reason_code text not null,
  reason_summary text not null,
  context_json jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references auth.users (id) on delete set null,
  constraint event_floor_plan_review_flags_target_layout check (
    target_kind <> 'layout'
    or (floor_plan_id is not null and flip_id is null)
  ),
  constraint event_floor_plan_review_flags_target_flip check (
    target_kind <> 'flip'
    or (flip_id is not null and floor_plan_id is null)
  )
);

create unique index if not exists event_floor_plan_review_flags_one_open
  on public.event_floor_plan_review_flags (
    event_id,
    target_kind,
    coalesce(floor_plan_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(flip_id, '00000000-0000-0000-0000-000000000000'::uuid),
    trigger_code
  )
  where status = 'open';

create index if not exists event_floor_plan_review_flags_venue_event
  on public.event_floor_plan_review_flags (venue_id, event_id, status);

create index if not exists event_floor_plan_review_flags_fingerprint
  on public.event_floor_plan_review_flags (event_id, fingerprint);

create trigger event_floor_plan_review_flags_updated_at
  before update on public.event_floor_plan_review_flags
  for each row execute function public.set_updated_at();

comment on table public.event_floor_plan_review_flags is
  'Phase 5: venue-only booking/layout/flip room-relationship review flags. Clear does not mutate layouts or seating.';

-- Venue / event integrity
create or replace function public.validate_event_floor_plan_review_flag()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event_venue uuid;
begin
  select venue_id into v_event_venue from public.events where id = new.event_id;
  if v_event_venue is null then
    raise exception 'event_floor_plan_review_flags: event not found';
  end if;
  if v_event_venue <> new.venue_id then
    raise exception 'event_floor_plan_review_flags: venue_id must match event.venue_id';
  end if;

  if new.floor_plan_id is not null then
    if not exists (
      select 1 from public.floor_plans fp
      where fp.id = new.floor_plan_id
        and fp.event_id = new.event_id
        and fp.venue_id = new.venue_id
    ) then
      raise exception 'event_floor_plan_review_flags: floor_plan must belong to the same event and venue';
    end if;
  end if;

  if new.flip_id is not null then
    if not exists (
      select 1 from public.event_floor_plan_flips f
      where f.id = new.flip_id
        and f.event_id = new.event_id
        and f.venue_id = new.venue_id
    ) then
      raise exception 'event_floor_plan_review_flags: flip must belong to the same event and venue';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists event_floor_plan_review_flags_validate on public.event_floor_plan_review_flags;
create trigger event_floor_plan_review_flags_validate
  before insert or update on public.event_floor_plan_review_flags
  for each row execute function public.validate_event_floor_plan_review_flag();

alter table public.event_floor_plan_review_flags enable row level security;

drop policy if exists event_floor_plan_review_flags_all on public.event_floor_plan_review_flags;
create policy event_floor_plan_review_flags_all on public.event_floor_plan_review_flags
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_floor_plan_review_flags to authenticated;
