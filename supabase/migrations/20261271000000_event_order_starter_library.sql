-- Hello to Cheers — Starter Event Order Library (EO-01 / EO-02)
-- source_master_key for protected master → independent venue copies.
-- Does not alter existing Event Order lifecycle, PDF, sharing, or financial pipelines.

alter table public.event_order_templates
  add column if not exists source_master_key text;

comment on column public.event_order_templates.source_master_key is
  'Hello to Cheers master key (EO-01, EO-02). Venue copies are editable; masters live in code.';

create unique index if not exists event_order_templates_venue_source_master_key_uidx
  on public.event_order_templates (venue_id, source_master_key)
  where source_master_key is not null;

-- Venue-create seed uses the admin/service_role client (same pattern as
-- message / questionnaire / contract starters).
grant select, insert, update on public.event_order_templates to service_role;
grant select, insert, update on public.event_order_template_sections to service_role;
grant select, insert, update on public.event_order_template_lines to service_role;
