-- ============================================================================
-- Phase 2A — Acquisition attribution foundation
--
-- Historical acquisition source is write-once:
--   leads.acquisition_source = source at lead entry (ingest / create).
-- Editing leads.source later must NOT rewrite historical reporting.
--
-- lifecycle_booking_events.acquisition_source is stamped on first_booked
-- from the lead's frozen acquisition_source (null for leadless direct/import).
-- Survives lead delete (lead_id ON DELETE SET NULL).
--
-- No UTM promotion. No visitor/session model. No GA4.
-- ============================================================================

-- ---- leads.acquisition_source ------------------------------------------------

alter table public.leads
  add column if not exists acquisition_source text
    references public.lead_sources (key);

comment on column public.leads.acquisition_source is
  'Write-once acquisition attribution: lead_sources key at lead entry. Distinct from operational leads.source, which may be edited later. Null/other → Unknown for Reporting coverage.';

-- Best-effort backfill for existing rows (may already reflect later edits).
update public.leads
set acquisition_source = source
where acquisition_source is null
  and source is not null
  and exists (select 1 from public.lead_sources ls where ls.key = leads.source);

create index if not exists leads_acquisition_source_idx
  on public.leads (venue_id, acquisition_source)
  where acquisition_source is not null;

-- Insert: default acquisition_source from source when omitted.
create or replace function public.leads_acquisition_source_on_insert()
returns trigger
language plpgsql
as $$
begin
  if new.acquisition_source is null and new.source is not null then
    new.acquisition_source := new.source;
  end if;
  return new;
end;
$$;

drop trigger if exists leads_acquisition_source_before_insert on public.leads;
create trigger leads_acquisition_source_before_insert
  before insert on public.leads
  for each row execute function public.leads_acquisition_source_on_insert();

-- Update: never overwrite a non-null acquisition_source.
create or replace function public.leads_acquisition_source_freeze()
returns trigger
language plpgsql
as $$
begin
  if old.acquisition_source is not null then
    new.acquisition_source := old.acquisition_source;
  end if;
  -- Do not stamp from mutable leads.source on UPDATE (INSERT trigger only).
  return new;
end;
$$;

drop trigger if exists leads_acquisition_source_before_update on public.leads;
create trigger leads_acquisition_source_before_update
  before update on public.leads
  for each row execute function public.leads_acquisition_source_freeze();

-- ---- lifecycle_booking_events.acquisition_source -----------------------------

alter table public.lifecycle_booking_events
  add column if not exists acquisition_source text
    references public.lead_sources (key);

comment on column public.lifecycle_booking_events.acquisition_source is
  'Frozen acquisition source copied from leads.acquisition_source at first_booked. Null = Unknown / Unattributed (leadless direct/import or missing lead attribution). Never invented.';

update public.lifecycle_booking_events e
set acquisition_source = l.acquisition_source
from public.leads l
where e.lead_id = l.id
  and e.event_kind = 'first_booked'
  and e.acquisition_source is null
  and l.acquisition_source is not null;

create index if not exists lifecycle_booking_events_acquisition_source_idx
  on public.lifecycle_booking_events (venue_id, acquisition_source)
  where acquisition_source is not null;

-- acquisition_source is stamped by BEFORE INSERT/UPDATE triggers on leads
-- (above) and by lib/lifecycle-bookings/service.ts on first_booked rows.
-- ingest_lead / create_lead_atomic are intentionally not rewritten here so
-- this migration stays additive across schema generations.
