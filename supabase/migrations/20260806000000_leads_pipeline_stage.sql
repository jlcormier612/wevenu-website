-- ============================================================================
-- Connect Leads to Pipeline Templates — Phase 2 (compatibility layer).
--
-- Adds exactly one nullable column. Does not touch leads.status, its check
-- constraint, log_lead_status_changed, get_venue_analytics, or the
-- message_sequences trigger_stage constraint — all continue to read/write
-- leads.status exactly as before. pipeline_stage_id is purely additive:
-- when set, it's the coordinator's explicit choice; when null, the app
-- derives a display stage from status on the fly (no backfill needed here).
-- ============================================================================

alter table public.leads
  add column pipeline_stage_id uuid references public.pipeline_stages (id) on delete set null;

create index leads_pipeline_stage on public.leads (pipeline_stage_id) where pipeline_stage_id is not null;

notify pgrst, 'reload schema';
