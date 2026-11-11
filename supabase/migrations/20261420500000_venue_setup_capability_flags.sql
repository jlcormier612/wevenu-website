-- ============================================================================
-- Venue-wide Setup Profile capability flags
--
-- Extends planning tools beyond Timeline / Floor Plan / Seating / Vendors so
-- Setup Profiles and booking inherit the same inclusion source of truth.
-- Defaults true: existing venues keep current behavior until they opt out.
-- Changing a flag must not rewrite venue_setup_profiles or event_setup_states.
-- ============================================================================

alter table public.venues
  add column if not exists planning_checklists_enabled boolean not null default true,
  add column if not exists planning_inventory_enabled boolean not null default true,
  add column if not exists planning_event_order_enabled boolean not null default true,
  add column if not exists planning_questionnaires_enabled boolean not null default true;

comment on column public.venues.planning_checklists_enabled is
  'When false, Client/Venue Planning checklists are not part of standard Setup Profiles or booking auto-apply.';
comment on column public.venues.planning_inventory_enabled is
  'When false, Inventory is not part of standard Setup Profiles or booking auto-apply.';
comment on column public.venues.planning_event_order_enabled is
  'When false, Event Order is not part of standard Setup Profiles or booking auto-apply.';
comment on column public.venues.planning_questionnaires_enabled is
  'When false, Questionnaires are not part of standard Setup Profiles or booking auto-apply.';

notify pgrst, 'reload schema';
