-- ============================================================================
-- Hello to Cheers — Wedding Venue Agreement starter (CTR-01)
-- source_master_key for protected master → independent venue copies
-- ============================================================================

alter table public.contract_templates
  add column if not exists source_master_key text;

create index if not exists contract_templates_venue_master_key
  on public.contract_templates (venue_id, source_master_key)
  where source_master_key is not null;

grant select, insert, update on public.contract_templates to service_role;

notify pgrst, 'reload schema';
