-- ============================================================================
-- White-Glove Customer Success Workspace — Phase 2 (§2.2a of
-- docs/hospitality-success-platform-implementation-plan.md).
--
-- The Onboarding Engagement: a session-spanning case file for a venue's
-- staff-assisted implementation, one layer above a single import_batches
-- run. Reuses hq_admins/is_hq_admin() for staff identity (no new auth),
-- venue_hq_tasks for blockers (one added column, not a new table).
--
-- Architectural reconciliation, found while building this (not assumed):
-- the plan's original sketch called for new "*_hq_write" RLS policies on
-- the migration/import entity tables (clients, vendors, packages,
-- inventory_items) so an HQ admin's own authenticated session could write
-- to them directly. That's now unnecessary — confirmed live that
-- `service_role` already has `rolbypassrls = true` in this database, and
-- the already-shipped create_client_atomic/create_vendor_atomic override
-- (20261141000000) deliberately only activates for genuine service_role
-- callers, not for an HQ admin's own authenticated session (which has no
-- venue of its own and would still fail current_user_venue_id()). So the
-- actual write path is: staff action checks is_hq_admin() at the app layer,
-- then executes via createAdminClient() (service_role) — RLS is bypassed
-- entirely for that call, only table GRANTs matter (already present).
-- venue_onboarding_engagements itself is different: an HQ admin manages
-- pause/resume/assignment through their OWN authenticated session (not
-- service_role, since this table isn't one of the migration/import
-- targets a venue could ever legitimately write to) — this table gets
-- ordinary is_hq_admin()-gated RLS, mirroring venue_hq_tasks exactly.
-- ============================================================================

create table public.venue_onboarding_engagements (
  id                    uuid primary key default gen_random_uuid(),
  -- One engagement per venue, not per attempt — reopening a completed
  -- engagement (e.g. a venue needs help again later) reuses the same row
  -- rather than accumulating a history table nobody asked for yet.
  venue_id              uuid not null unique references public.venues(id) on delete cascade,
  assigned_hq_admin_id  uuid references auth.users(id) on delete set null,
  status                text not null default 'not_started'
                          check (status in ('not_started', 'in_progress', 'paused', 'blocked', 'complete')),
  current_focus         text,
  started_at            timestamptz,
  paused_at             timestamptz,
  resumed_at            timestamptz,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index venue_onboarding_engagements_status on public.venue_onboarding_engagements (status);
create index venue_onboarding_engagements_assigned on public.venue_onboarding_engagements (assigned_hq_admin_id);

create trigger venue_onboarding_engagements_updated_at
  before update on public.venue_onboarding_engagements
  for each row execute function public.set_updated_at();

alter table public.venue_onboarding_engagements enable row level security;

-- Same shape as venue_hq_tasks' existing policies (select/insert/update,
-- gated on is_hq_admin() alone, no per-assignment restriction) — any HQ
-- admin can see and act on any venue's engagement, matching how the rest
-- of Wevenu HQ already treats the whole admin roster as one team rather
-- than partitioning visibility by assignment.
create policy onboarding_engagements_select on public.venue_onboarding_engagements
  for select to authenticated using (is_hq_admin());
create policy onboarding_engagements_insert on public.venue_onboarding_engagements
  for insert to authenticated with check (is_hq_admin());
create policy onboarding_engagements_update on public.venue_onboarding_engagements
  for update to authenticated using (is_hq_admin());

grant select, insert, update on public.venue_onboarding_engagements to authenticated;

-- ── Blockers reuse venue_hq_tasks — one added column, not a new table ──────

alter table public.venue_hq_tasks
  add column kind text not null default 'task' check (kind in ('task', 'blocker'));

-- Optional link from a blocker (or a follow-up task raised during an
-- engagement) back to the engagement it belongs to — nullable, since
-- venue_hq_tasks predates engagements entirely and most tasks will
-- continue to have nothing to do with a staff-assisted implementation.
alter table public.venue_hq_tasks
  add column engagement_id uuid references public.venue_onboarding_engagements(id) on delete set null;

create index venue_hq_tasks_engagement on public.venue_hq_tasks (engagement_id) where engagement_id is not null;

-- Same optional link on import_batches — so "what did this engagement
-- actually import" is a direct query, not a timestamp-window guess.
alter table public.import_batches
  add column engagement_id uuid references public.venue_onboarding_engagements(id) on delete set null;

create index import_batches_engagement on public.import_batches (engagement_id) where engagement_id is not null;

notify pgrst, 'reload schema';
