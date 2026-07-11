-- ============================================================================
-- Floor Plan Template Library
--
-- Mirrors the Timeline Template / Planning Template shape exactly: a
-- reusable template table plus its own objects table, fully separate from
-- floor_plans/floor_plan_objects (a booking's actual floor plan) — no
-- booking is affected by anything here (Requirement 6/10). The existing
-- Floor Plan editor is reused in "template mode" by pointing it at these
-- tables instead — see components/floor-plan/floor-plan-editor.tsx.
-- ============================================================================

create table public.floor_plan_templates (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,

  name        text not null check (char_length(trim(name)) > 0),
  event_type  text,
  space_id    uuid references public.venue_spaces (id) on delete set null,
  is_default  boolean not null default false,
  is_archived boolean not null default false,

  background_image_url     text,
  background_image_opacity numeric(3,2) not null default 0.25,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index floor_plan_templates_venue on public.floor_plan_templates (venue_id);

-- One default per (event_type, space) combination — same coalesced pattern
-- as timeline_templates_default and playbook_templates_default.
create unique index floor_plan_templates_default
  on public.floor_plan_templates (venue_id, coalesce(event_type, ''), coalesce(space_id::text, ''))
  where is_default = true;

create trigger floor_plan_templates_updated_at
  before update on public.floor_plan_templates
  for each row execute function public.set_updated_at();

create table public.floor_plan_template_objects (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  template_id  uuid not null references public.floor_plan_templates (id) on delete cascade,

  object_type  text not null default 'table_round'
    check (object_type = any (array['table_round','table_rect','table_oval','stage','dance_floor','bar','gift_table','cake_table','text_label','other'])),
  label        text,
  capacity     integer check (capacity is null or capacity >= 0),
  x            numeric(8,2) not null default 400,
  y            numeric(8,2) not null default 300,
  width        numeric(8,2) not null default 80,
  height       numeric(8,2) not null default 80,
  rotation     numeric(6,1) not null default 0,
  sort_order   smallint not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index floor_plan_template_objects_template on public.floor_plan_template_objects (template_id, sort_order);

create trigger floor_plan_template_objects_updated_at
  before update on public.floor_plan_template_objects
  for each row execute function public.set_updated_at();

-- ---- RLS ---------------------------------------------------------------------
alter table public.floor_plan_templates        enable row level security;
alter table public.floor_plan_template_objects enable row level security;

create policy floor_plan_templates_all on public.floor_plan_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy floor_plan_template_objects_all on public.floor_plan_template_objects
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.floor_plan_templates        to authenticated;
grant select, insert, update, delete on public.floor_plan_template_objects to authenticated;

notify pgrst, 'reload schema';
