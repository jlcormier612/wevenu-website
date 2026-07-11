-- ============================================================================
-- Inventory Foundation
--
-- A venue's reusable physical inventory (tables, chairs, decor, ...), fully
-- decoupled from any booking (Requirement 7) — items live in a venue-wide
-- catalog, and a Floor Plan object may optionally point at one for its
-- name/dimensions and for usage reporting (Requirement 6). Floor Plans /
-- Booking Floor Plans themselves are otherwise untouched: object_type and
-- its check constraint are unchanged, so the existing rendering system in
-- components/floor-plan/floor-plan-editor.tsx needs no redesign — an
-- inventory item just maps to the closest existing shape when placed.
-- ============================================================================

-- inventory_categories ---------------------------------------------------------
-- Venue-defined, not a hardcoded list (Requirement 3) — same shape/spirit
-- as venue_spaces.
create table public.inventory_categories (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (venue_id, name)
);

create index inventory_categories_venue on public.inventory_categories (venue_id, sort_order);

create trigger inventory_categories_updated_at
  before update on public.inventory_categories
  for each row execute function public.set_updated_at();

-- inventory_items ---------------------------------------------------------------
create table public.inventory_items (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  category_id   uuid references public.inventory_categories (id) on delete set null,

  name              text not null check (char_length(trim(name)) > 0),
  quantity_available integer not null default 0 check (quantity_available >= 0),

  width  numeric(8,2) check (width  is null or width  > 0),
  length numeric(8,2) check (length is null or length > 0),
  height numeric(8,2) check (height is null or height > 0),

  -- Optional visual footprint on the Floor Plan canvas — maps to the
  -- closest existing shape; unset/'custom' renders as a plain rectangle.
  shape  text check (shape is null or shape in ('round', 'rectangular', 'oval', 'square', 'custom')),
  color  text,

  image_url      text,
  printable_name text,

  is_archived              boolean not null default false,
  available_for_floor_plans boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index inventory_items_venue on public.inventory_items (venue_id);
create index inventory_items_category on public.inventory_items (category_id);
create index inventory_items_floor_plan_eligible on public.inventory_items (venue_id, available_for_floor_plans) where is_archived = false;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- Floor Plan objects may point at the inventory item they were placed
-- from — additive and nullable, purely for usage reporting (Requirement 6).
-- Floor Plans are not otherwise modified: object_type's own check
-- constraint, defaults, and every other column are untouched.
alter table public.floor_plan_objects
  add column inventory_item_id uuid references public.inventory_items (id) on delete set null;

alter table public.floor_plan_template_objects
  add column inventory_item_id uuid references public.inventory_items (id) on delete set null;

create index floor_plan_objects_inventory_item on public.floor_plan_objects (inventory_item_id) where inventory_item_id is not null;
create index floor_plan_template_objects_inventory_item on public.floor_plan_template_objects (inventory_item_id) where inventory_item_id is not null;

-- Supabase Storage bucket for inventory item photos --------------------------
insert into storage.buckets (id, name, public)
values ('inventory', 'inventory', true)
on conflict (id) do nothing;

create policy "inventory_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inventory');

create policy "inventory_storage_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'inventory');

create policy "inventory_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'inventory');

-- ---- RLS ---------------------------------------------------------------------
alter table public.inventory_categories enable row level security;
alter table public.inventory_items      enable row level security;

create policy inventory_categories_all on public.inventory_categories
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy inventory_items_all on public.inventory_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.inventory_categories to authenticated;
grant select, insert, update, delete on public.inventory_items      to authenticated;

notify pgrst, 'reload schema';
