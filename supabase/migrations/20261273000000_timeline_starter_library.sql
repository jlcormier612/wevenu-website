-- Hello to Cheers — Starter Timeline Library (TL-01 / TL-02 / TL-03)
-- source_master_key for protected masters → independent venue copies.
-- Does not alter Working Timeline lifecycle, audiences, or apply semantics.

alter table public.timeline_templates
  add column if not exists source_master_key text;

comment on column public.timeline_templates.source_master_key is
  'Hello to Cheers master key (TL-01, TL-02, TL-03). Venue copies are editable; masters live in code.';

create unique index if not exists timeline_templates_venue_source_master_key_uidx
  on public.timeline_templates (venue_id, source_master_key)
  where source_master_key is not null;

-- Venue-create seed uses the admin/service_role client (same pattern as
-- message / questionnaire / contract / EO / inventory starters).
grant select, insert, update on public.timeline_templates to service_role;
grant select, insert, update on public.timeline_template_items to service_role;
