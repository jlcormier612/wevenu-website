-- ============================================================================
-- Commitment Alignment Sprint — Seating Delegation & Submission (schema)
--
-- docs/commitment-lifecycle-architecture.md §7/§9, extended per direct
-- instruction (2026-07-17): the Commitment Lifecycle applies to each
-- seating plan (floor plan) independently, not to "seating" as one
-- undifferentiated thing — a booking may have Ceremony and Reception plans,
-- each with its own draft, submission, commitment, version history, and
-- delegation lifecycle.
--
-- That requires a real schema fix, not just new tables: guest_seat_assignments
-- had `unique(guest_id)` with no floor_plan_id on the row at all — a guest
-- could only ever hold one seat across the ENTIRE booking, so a second
-- floor plan's assignment would silently overwrite the first (on conflict
-- (guest_id) do update). floor_plan_id becomes a first-class column, set
-- explicitly at assignment time (not derived transitively through
-- table_object_id, which can go null if a table shape is later deleted —
-- see the "needsReassignment" case in get_seating_data) so a guest's
-- per-plan seat history survives table deletions correctly.
-- ============================================================================

alter table public.guest_seat_assignments
  add column floor_plan_id uuid references public.floor_plans(id) on delete cascade;

-- Backfill from the existing table_object_id -> floor_plan_objects join,
-- for the rows where that path still resolves (a pre-existing row whose
-- table was since deleted, per floor_plan_objects' own "on delete set
-- null" behavior, has no derivable floor_plan_id and is left null here —
-- a narrow, pre-existing data-quality edge case, not something this
-- migration can recover; nullable floor_plan_id remains valid under the
-- new unique constraint below).
update public.guest_seat_assignments gsa
set floor_plan_id = fpo.floor_plan_id
from public.floor_plan_objects fpo
where gsa.table_object_id = fpo.id and gsa.floor_plan_id is null;

alter table public.guest_seat_assignments drop constraint guest_seat_assignments_guest_id_key;
alter table public.guest_seat_assignments add constraint guest_seat_assignments_guest_id_floor_plan_id_key
  unique (guest_id, floor_plan_id);

create index guest_seat_assignments_floor_plan on public.guest_seat_assignments (floor_plan_id);

-- ── seating_submissions — append-only, one immutable row per commit ─────────
-- Commitment Lifecycle Architecture §5 (Versioning): a snapshot, not a live
-- reference — self-contained (captures guest name / table label at the
-- moment of commit) so the historical record stays meaningful even if a
-- guest is later renamed or a table shape is deleted.
create table public.seating_submissions (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  venue_id         uuid not null references public.venues(id) on delete cascade,
  event_id         uuid not null references public.events(id) on delete cascade,
  floor_plan_id    uuid not null references public.floor_plans(id) on delete cascade,
  snapshot         jsonb not null,
  guest_count      integer not null default 0,
  submitted_by     text not null check (submitted_by in ('couple', 'venue')),
  created_at       timestamptz not null default now()
);

create index seating_submissions_plan on public.seating_submissions (floor_plan_id, created_at desc);

alter table public.seating_submissions enable row level security;

create policy seating_submissions_venue_select
  on public.seating_submissions for select
  using (venue_id = current_user_venue_id());

grant select on public.seating_submissions to authenticated;

-- ── seating_delegations — explicit, scoped, revocable, visible to both ──────
-- Commitment Lifecycle Architecture §7: authorship transfer, not just
-- visibility. At most one ACTIVE delegation per floor plan at a time (the
-- partial unique index below), so "who currently holds the pen" is never
-- ambiguous.
create table public.seating_delegations (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  venue_id         uuid not null references public.venues(id) on delete cascade,
  event_id         uuid not null references public.events(id) on delete cascade,
  floor_plan_id    uuid not null references public.floor_plans(id) on delete cascade,
  note             text,
  granted_at       timestamptz not null default now(),
  revoked_at       timestamptz,
  revoked_by       text check (revoked_by in ('couple', 'venue'))
);

create unique index seating_delegations_active_per_plan
  on public.seating_delegations (floor_plan_id) where revoked_at is null;

alter table public.seating_delegations enable row level security;

create policy seating_delegations_venue_select
  on public.seating_delegations for select
  using (venue_id = current_user_venue_id());

grant select on public.seating_delegations to authenticated;
