-- ============================================================================
-- Facebook Lead Ads queue: one row per (venue, leadgen_id) forever.
--
-- The original partial unique index only covered unresolved statuses, so a
-- redelivered webhook after success could insert a second pending row.
-- ingest_lead's external_ref still prevented duplicate Leads, but the queue
-- itself was not idempotent. Meta leadgen_id is stable and unique per lead
-- — never reprocess a succeeded/dead-lettered id.
-- ============================================================================

delete from public.facebook_lead_queue a
using public.facebook_lead_queue b
where a.ctid < b.ctid
  and a.venue_id = b.venue_id
  and a.leadgen_id = b.leadgen_id;

drop index if exists public.facebook_lead_queue_unresolved;

alter table public.facebook_lead_queue
  drop constraint if exists facebook_lead_queue_venue_leadgen;

alter table public.facebook_lead_queue
  add constraint facebook_lead_queue_venue_leadgen unique (venue_id, leadgen_id);

notify pgrst, 'reload schema';
