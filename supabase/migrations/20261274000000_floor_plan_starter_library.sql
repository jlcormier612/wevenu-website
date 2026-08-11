-- Hello to Cheers — Starter Floor Plan Library (FP-01 / FP-02)
-- source_master_key for protected masters → independent venue copies.
-- Does not alter Working Floor Plan lifecycle, seating, or apply semantics.

alter table public.floor_plan_templates
  add column if not exists source_master_key text;

comment on column public.floor_plan_templates.source_master_key is
  'Hello to Cheers master key (FP-01, FP-02). Venue copies are editable; masters live in code.';

create unique index if not exists floor_plan_templates_venue_source_master_key_uidx
  on public.floor_plan_templates (venue_id, source_master_key)
  where source_master_key is not null;

-- Venue-create seed uses the admin/service_role client (same pattern as
-- message / questionnaire / contract / EO / inventory / timeline starters).
grant select, insert, update on public.floor_plan_templates to service_role;
grant select, insert, update on public.floor_plan_template_objects to service_role;
