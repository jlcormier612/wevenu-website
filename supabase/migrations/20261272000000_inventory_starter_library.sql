-- Hello to Cheers — Starter Inventory Catalog + Inventory Templates
-- source_master_key for protected masters → independent venue copies.
-- Does not alter D5A Working Inventory / finalization / Event Order handoff.

alter table public.inventory_categories
  add column if not exists source_master_key text;

comment on column public.inventory_categories.source_master_key is
  'Hello to Cheers catalog starter category key (INV-CAT-*). Venue copies are editable; masters live in code.';

create unique index if not exists inventory_categories_venue_source_master_key_uidx
  on public.inventory_categories (venue_id, source_master_key)
  where source_master_key is not null;

alter table public.inventory_templates
  add column if not exists source_master_key text;

comment on column public.inventory_templates.source_master_key is
  'Hello to Cheers template master key (INV-01, INV-02). Venue copies are editable; masters live in code.';

create unique index if not exists inventory_templates_venue_source_master_key_uidx
  on public.inventory_templates (venue_id, source_master_key)
  where source_master_key is not null;

grant select, insert, update on public.inventory_categories to service_role;
grant select, insert, update on public.inventory_items to service_role;
grant select, insert, update on public.inventory_templates to service_role;
grant select, insert, update on public.inventory_template_items to service_role;
