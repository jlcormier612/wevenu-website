-- ============================================================================
-- Planning capabilities — venue-level optional planning surfaces
--
-- A venue may not use Timeline, Floor Plan, Seating, or Preferred Vendors.
-- These flags gate Event Readiness, couple portal navigation, and whether
-- apply creates required tasks tied to those capabilities. Defaults true so
-- existing venues keep today's behavior until they opt out.
-- ============================================================================

alter table public.venues
  add column if not exists planning_timeline_enabled boolean not null default true,
  add column if not exists planning_floor_plan_enabled boolean not null default true,
  add column if not exists planning_seating_enabled boolean not null default true,
  add column if not exists planning_vendors_enabled boolean not null default true;

comment on column public.venues.planning_timeline_enabled is
  'When false, Timeline is not a planning capability for this venue (readiness/portal/apply).';
comment on column public.venues.planning_floor_plan_enabled is
  'When false, Floor Plan is not a planning capability for this venue.';
comment on column public.venues.planning_seating_enabled is
  'When false, Seating is not a planning capability for this venue.';
comment on column public.venues.planning_vendors_enabled is
  'When false, Preferred Vendors is not a planning capability for this venue.';

notify pgrst, 'reload schema';
