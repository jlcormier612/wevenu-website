-- ============================================================================
-- Prevent duplicate Planning Playbook application
--
-- docs/planning-playbook-evolution.md named this as a real correctness gap:
-- applyPlaybookToEvent had no guard against being called twice for the same
-- event — no unique constraint, no dedup — so a double-click or a race would
-- insert a second full set of tasks alongside the first.
--
-- V1 behavior, per explicit product decision: one playbook per event, full
-- stop. If a playbook has already been applied, block a second application
-- (same or different template) and explain why, rather than allow a
-- replace/merge. That richer behavior is deferred to a future release,
-- named in docs/product-backlog.md rather than built speculatively.
--
-- event_playbook_applications is a small, deliberately-justified new entity:
-- a single, atomic fact ("has a playbook been applied to this event, and
-- which one") that both the service layer and the database can check against,
-- rather than inferring "already applied" from event_tasks row counts, which
-- would be indirect and not race-safe (Engineering Standard #3 — enforcement
-- in the service layer for a clear error, and a DB-level backstop that holds
-- even if the service check is somehow bypassed).
-- ============================================================================

create table public.event_playbook_applications (
  event_id      uuid primary key references public.events (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,
  template_id   uuid references public.playbook_templates (id) on delete set null,
  template_name text not null,
  applied_at    timestamptz not null default now()
);

create index event_playbook_applications_venue on public.event_playbook_applications (venue_id);

alter table public.event_playbook_applications enable row level security;

create policy "event_playbook_applications_all" on public.event_playbook_applications
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_playbook_applications to authenticated;

notify pgrst, 'reload schema';
