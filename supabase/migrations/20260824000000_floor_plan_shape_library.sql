-- ============================================================================
-- Floor Plan Completion — Phase 2: Shape Library
--
-- Additive only. Widens the existing inventory_items.shape vocabulary
-- (round/rectangular/oval/square/custom, unchanged) with the display-shape
-- categories a venue actually stocks (Reception/Ceremony/Furniture), and
-- carries the chosen shape onto a placed object at insert time — the same
-- pattern Phase 1 used for color/notes (a per-placement copy, never a live
-- reference back to the Inventory item; changing a placed object never
-- changes the Inventory item).
--
-- No table is redesigned: inventory_items keeps its shape column and every
-- other field; floor_plan_objects/floor_plan_template_objects keep
-- object_type (unchanged, still the coarse category used by existing print
-- legend logic) and simply gain one new nullable column.
-- ============================================================================

alter table public.inventory_items drop constraint inventory_items_shape_check;
alter table public.inventory_items add constraint inventory_items_shape_check
  check (shape is null or shape in (
    'round', 'square', 'rectangular', 'oval', 'cocktail',
    'dance_floor', 'stage', 'dj_booth', 'bar', 'buffet',
    'arbor', 'arch', 'aisle',
    'sofa', 'lounge',
    'custom'
  ));

alter table public.floor_plan_objects
  add column display_shape text check (display_shape is null or display_shape in (
    'round', 'square', 'rectangular', 'oval', 'cocktail',
    'dance_floor', 'stage', 'dj_booth', 'bar', 'buffet',
    'arbor', 'arch', 'aisle',
    'sofa', 'lounge',
    'custom'
  ));

alter table public.floor_plan_template_objects
  add column display_shape text check (display_shape is null or display_shape in (
    'round', 'square', 'rectangular', 'oval', 'cocktail',
    'dance_floor', 'stage', 'dj_booth', 'bar', 'buffet',
    'arbor', 'arch', 'aisle',
    'sofa', 'lounge',
    'custom'
  ));

-- Backfill only where a clean, lossless mapping from the existing
-- object_type exists — every other row (gift_table, cake_table, text_label,
-- other) stays null and keeps rendering exactly as it does today via the
-- pre-existing object_type/OBJECT_STYLE fallback path. No visual change for
-- any object placed before this migration.
update public.floor_plan_objects set display_shape = case object_type
  when 'table_round' then 'round'
  when 'table_rect'  then 'rectangular'
  when 'table_oval'  then 'oval'
  when 'stage'       then 'stage'
  when 'dance_floor' then 'dance_floor'
  when 'bar'         then 'bar'
  else null
end
where display_shape is null;

update public.floor_plan_template_objects set display_shape = case object_type
  when 'table_round' then 'round'
  when 'table_rect'  then 'rectangular'
  when 'table_oval'  then 'oval'
  when 'stage'       then 'stage'
  when 'dance_floor' then 'dance_floor'
  when 'bar'         then 'bar'
  else null
end
where display_shape is null;

notify pgrst, 'reload schema';
