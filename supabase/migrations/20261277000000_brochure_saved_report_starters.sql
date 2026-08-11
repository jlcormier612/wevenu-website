-- Hello to Cheers — Brochure + Saved Report starter library
-- Protected masters → venue-owned copies. Idempotent. No financial side effects.
-- Does not change public brochure sharing architecture (share_token remains as today).

alter table public.brochures
  add column if not exists source_master_key text;

comment on column public.brochures.source_master_key is
  'Hello to Cheers master key (e.g. BR-01). Venue copies are editable; masters live in code.';

create unique index if not exists brochures_venue_source_master_key_uidx
  on public.brochures (venue_id, source_master_key)
  where source_master_key is not null;

alter table public.saved_reports
  add column if not exists source_master_key text;

comment on column public.saved_reports.source_master_key is
  'Hello to Cheers master key (e.g. SR-SALES). Venue copies are editable; masters live in code.';

create unique index if not exists saved_reports_venue_source_master_key_uidx
  on public.saved_reports (venue_id, source_master_key)
  where source_master_key is not null;

grant select, insert, update on public.brochures to service_role;
grant select, insert on public.brochure_activities to service_role;
grant select, insert, update on public.saved_reports to service_role;
