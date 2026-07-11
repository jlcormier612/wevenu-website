-- ============================================================================
-- Floor Plan Editor Completion (Phase 1)
--
-- Additive only. No existing column, default, or check constraint is
-- changed on floor_plans, floor_plan_templates, floor_plan_objects,
-- floor_plan_template_objects, or any Inventory table.
--
-- Canvas units have always been treated as inches (Inventory items already
-- carry width/length as plain numbers, e.g. a "60" Round" table has
-- width = 60). A floor plan's logical canvas has always been a fixed
-- 800x600 unit rectangle; this migration makes that rectangle's real-world
-- size (room_width_ft x room_depth_ft) an explicit, per-plan, editable
-- setting instead of an unstated assumption. Existing rows are backfilled
-- to 800/12 x 600/12 feet so every already-authored floor plan's canvas
-- size — and therefore every existing object's position relative to the
-- room boundary — is numerically unchanged by this migration. New plans
-- default to a rounder 60x40 ft room.
-- ============================================================================

alter table public.floor_plans
  add column room_width_ft numeric(6,2) not null default 60,
  add column room_depth_ft numeric(6,2) not null default 40,
  add column measurement_unit text not null default 'feet_inches'
    check (measurement_unit in ('feet_inches', 'decimal_feet')),
  add column background_locked boolean not null default false;

update public.floor_plans set room_width_ft = 800.0/12, room_depth_ft = 600.0/12;

alter table public.floor_plan_templates
  add column room_width_ft numeric(6,2) not null default 60,
  add column room_depth_ft numeric(6,2) not null default 40,
  add column measurement_unit text not null default 'feet_inches'
    check (measurement_unit in ('feet_inches', 'decimal_feet')),
  add column background_locked boolean not null default false;

update public.floor_plan_templates set room_width_ft = 800.0/12, room_depth_ft = 600.0/12;

-- Per-object properties: color/notes overrides and a position lock.
-- Overriding these on a placed object never writes back to the Inventory
-- item it was placed from (lib/inventory rows are untouched by any of the
-- code this migration supports).
alter table public.floor_plan_objects
  add column color  text,
  add column notes  text,
  add column locked boolean not null default false;

alter table public.floor_plan_template_objects
  add column color  text,
  add column notes  text,
  add column locked boolean not null default false;

notify pgrst, 'reload schema';
