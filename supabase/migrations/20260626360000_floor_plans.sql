-- ============================================================================
-- Sprint 18 — Floor Plan Studio Lite
-- "A venue coordinator should be able to visualize and communicate
--  the event layout with confidence."
--
-- Two tables + Supabase Storage bucket for background images.
-- The canvas uses a fixed 800×600 logical coordinate space (4:3 aspect ratio).
-- Object positions are stored in that coordinate space and scale automatically
-- with the SVG viewBox when rendered at any screen size.
-- ============================================================================

-- Supabase Storage bucket for floor plan background images ----------------
insert into storage.buckets (id, name, public)
values ('floor-plans', 'floor-plans', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload/read; anonymous users can read public images
create policy "floor_plans_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'floor-plans');

create policy "floor_plans_storage_select" on storage.objects
  for select to authenticated, anon
  using (bucket_id = 'floor-plans');

create policy "floor_plans_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'floor-plans');

-- floor_plans — one per event ---------------------------------------------
create table public.floor_plans (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade unique,

  name        text not null default 'Floor Plan',

  -- Background image (stored in the floor-plans bucket)
  background_image_url     text,
  background_image_opacity numeric(3, 2) not null default 0.25
                             check (background_image_opacity between 0 and 1),

  notes text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index floor_plans_venue on public.floor_plans (venue_id);
create index floor_plans_event on public.floor_plans (event_id);

create trigger floor_plans_updated_at
  before update on public.floor_plans
  for each row execute function public.set_updated_at();

-- floor_plan_objects — tables, stage, dance floor, labels, etc. -----------
-- All coordinates are in the 800×600 logical canvas space.
create table public.floor_plan_objects (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues    (id) on delete cascade,
  floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,

  object_type   text not null default 'table_round'
                  check (object_type in (
                    'table_round', 'table_rect', 'table_oval',
                    'stage', 'dance_floor', 'bar',
                    'gift_table', 'cake_table', 'text_label', 'other'
                  )),

  label         text,
  capacity      integer check (capacity is null or capacity >= 0),

  -- Position: center of the object in the 800×600 canvas
  x             numeric(8, 2) not null default 400,
  y             numeric(8, 2) not null default 300,

  -- Size: in canvas units
  width         numeric(8, 2) not null default 80,
  height        numeric(8, 2) not null default 80,

  -- Rotation in degrees
  rotation      numeric(6, 1) not null default 0,

  -- Render order (higher = on top)
  sort_order    smallint not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index floor_plan_objects_plan on public.floor_plan_objects (floor_plan_id, sort_order);

create trigger floor_plan_objects_updated_at
  before update on public.floor_plan_objects
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.floor_plans        enable row level security;
alter table public.floor_plan_objects enable row level security;

create policy floor_plans_all on public.floor_plans
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy floor_plan_objects_all on public.floor_plan_objects
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.floor_plans        to authenticated;
grant select, insert, update, delete on public.floor_plan_objects to authenticated;

notify pgrst, 'reload schema';
