-- Offerings catalog + Event Order delivery-model foundations.
-- Additive only. Preserves existing event_order_* rows.
--
-- Locked product model:
--   Offerings = what the venue can provide (menus, bar, services, rentals)
--   Inventory = physical stock (unchanged)
--   Event Order = what this event is receiving (selects Offerings primarily)
--   Client share = frozen snapshot until re-share (not live lines after reopen)

-- ---- 1. Offerings catalog -------------------------------------------------------

create table public.offering_categories (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null check (char_length(trim(name)) > 0),
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (venue_id, name)
);

create index offering_categories_venue on public.offering_categories (venue_id, sort_order);

create trigger offering_categories_updated_at
  before update on public.offering_categories
  for each row execute function public.set_updated_at();

create table public.offerings (
  id                   uuid primary key default gen_random_uuid(),
  venue_id             uuid not null references public.venues (id) on delete cascade,
  category_id          uuid references public.offering_categories (id) on delete set null,

  name                 text not null check (char_length(trim(name)) > 0),
  description          text,
  unit                 text,
  default_unit_price   numeric(10,2) check (default_unit_price is null or default_unit_price >= 0),

  -- Optional dual-identity link to physical Inventory (rentals).
  inventory_item_id    uuid references public.inventory_items (id) on delete set null,

  is_archived          boolean not null default false,
  sort_order           smallint not null default 0,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index offerings_venue on public.offerings (venue_id);
create index offerings_venue_active on public.offerings (venue_id, is_archived) where is_archived = false;
create index offerings_category on public.offerings (category_id);
create index offerings_inventory_item on public.offerings (inventory_item_id) where inventory_item_id is not null;

create trigger offerings_updated_at
  before update on public.offerings
  for each row execute function public.set_updated_at();

alter table public.offering_categories enable row level security;
alter table public.offerings enable row level security;

create policy offering_categories_all on public.offering_categories
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy offerings_all on public.offerings
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.offering_categories to authenticated;
grant select, insert, update, delete on public.offerings to authenticated;
grant select, insert, update, delete on public.offering_categories to service_role;
grant select, insert, update, delete on public.offerings to service_role;

-- Fix Event Inventory service_role grants (discovered gap).
grant select, insert, update, delete on public.event_inventory to service_role;
grant select, insert, update, delete on public.event_inventory_items to service_role;
grant select, insert, update, delete on public.event_inventory_activities to service_role;
grant select, insert, update, delete on public.inventory_templates to service_role;
grant select, insert, update, delete on public.inventory_template_items to service_role;

-- ---- 2. Event Order line model extensions --------------------------------------

alter table public.event_order_lines
  drop constraint if exists event_order_lines_provenance_check;

alter table public.event_order_lines
  add column if not exists offering_id uuid references public.offerings (id) on delete set null,
  add column if not exists unit text,
  add column if not exists notes text,
  add column if not exists is_included boolean not null default true,
  add column if not exists description_detail text;

-- Allow null unit_price = unpriced delivery line (amount treated as 0 for totals).
alter table public.event_order_lines
  alter column unit_price drop not null;

alter table public.event_order_lines
  add constraint event_order_lines_provenance_check
  check (provenance in ('package', 'inventory', 'custom', 'offering'));

alter table public.event_order_lines
  drop constraint if exists event_order_lines_unit_price_check;

alter table public.event_order_lines
  add constraint event_order_lines_unit_price_check
  check (unit_price is null or unit_price >= 0);

create index if not exists event_order_lines_offering
  on public.event_order_lines (offering_id) where offering_id is not null;

-- Template sections may carry optional guidance (not task lines).
alter table public.event_order_template_sections
  add column if not exists guidance text;

-- ---- 3. Client share snapshots (frozen until re-share) -------------------------

create table public.event_order_share_snapshots (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  event_order_id  uuid not null references public.event_orders (id) on delete cascade,
  revision        integer not null check (revision >= 0),
  shared_at       timestamptz not null default now(),
  -- Client-visible payload: sections + lines with Included/Additional, qty, optional prices.
  payload         jsonb not null,
  created_at      timestamptz not null default now()
);

create index event_order_share_snapshots_order
  on public.event_order_share_snapshots (event_order_id, shared_at desc);
create index event_order_share_snapshots_venue
  on public.event_order_share_snapshots (venue_id);

alter table public.event_order_share_snapshots enable row level security;

create policy event_order_share_snapshots_select on public.event_order_share_snapshots
  for select
  using (venue_id = public.current_user_venue_id());

create policy event_order_share_snapshots_insert on public.event_order_share_snapshots
  for insert
  with check (venue_id = public.current_user_venue_id());

-- Snapshots are immutable history — no update/delete for authenticated venue users.
grant select, insert on public.event_order_share_snapshots to authenticated;
grant select, insert, update, delete on public.event_order_share_snapshots to service_role;

-- Portal reads the latest share snapshot (not live lines after reopen).
-- Drop prior signature first — return columns changed.
drop function if exists public.get_event_order_for_portal(text);

create or replace function public.get_event_order_for_portal(p_token text)
returns table (
  id            uuid,
  status        text,
  revision      int,
  shared_at     timestamptz,
  section_id    uuid,
  section_name  text,
  line_id       uuid,
  line_description text,
  line_quantity numeric,
  line_amount   numeric,
  line_sort_order smallint,
  line_is_included boolean,
  line_unit text,
  line_unit_price numeric,
  line_notes text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_order public.event_orders%rowtype;
  v_snap public.event_order_share_snapshots%rowtype;
  v_line jsonb;
  v_section jsonb;
  v_sections jsonb;
  v_lines jsonb;
  v_sec_name text;
  v_sec_id uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return; end if;

  select eo.* into v_order
  from public.event_orders eo
  join public.events e on e.id = eo.event_id
  where e.client_id = v_session.client_id
    and eo.venue_id = v_session.venue_id
    and eo.shared_at is not null
  order by eo.updated_at desc
  limit 1;
  if not found then return; end if;

  select * into v_snap
  from public.event_order_share_snapshots
  where event_order_id = v_order.id
  order by shared_at desc
  limit 1;

  -- Prefer frozen snapshot. Fall back to live lines only if no snapshot exists
  -- (legacy shares created before this migration).
  if found then
    v_sections := coalesce(v_snap.payload->'sections', '[]'::jsonb);
    v_lines := coalesce(v_snap.payload->'lines', '[]'::jsonb);

    for v_line in select * from jsonb_array_elements(v_lines)
    loop
      v_sec_id := nullif(v_line->>'sectionId', '')::uuid;
      v_sec_name := null;
      if v_sec_id is not null then
        select s->>'name' into v_sec_name
        from jsonb_array_elements(v_sections) s
        where (s->>'id') = v_line->>'sectionId'
        limit 1;
      end if;

      id := v_order.id;
      status := v_order.status;
      revision := v_snap.revision;
      shared_at := v_snap.shared_at;
      section_id := v_sec_id;
      section_name := v_sec_name;
      line_id := nullif(v_line->>'id', '')::uuid;
      line_description := v_line->>'description';
      line_quantity := coalesce((v_line->>'quantity')::numeric, 1);
      line_amount := coalesce((v_line->>'amount')::numeric, 0);
      line_sort_order := coalesce((v_line->>'sortOrder')::smallint, 0);
      line_is_included := coalesce((v_line->>'isIncluded')::boolean, true);
      line_unit := v_line->>'unit';
      line_unit_price := nullif(v_line->>'unitPrice', '')::numeric;
      line_notes := v_line->>'notes';
      return next;
    end loop;

    -- Shared but empty snapshot still returns a header row so the portal
    -- can show "shared, no lines" rather than "nothing to show".
    if jsonb_array_length(v_lines) = 0 then
      id := v_order.id;
      status := v_order.status;
      revision := v_snap.revision;
      shared_at := v_snap.shared_at;
      section_id := null;
      section_name := null;
      line_id := null;
      line_description := null;
      line_quantity := null;
      line_amount := null;
      line_sort_order := null;
      line_is_included := null;
      line_unit := null;
      line_unit_price := null;
      line_notes := null;
      return next;
    end if;
    return;
  end if;

  -- Legacy fallback: live lines (pre-snapshot shares).
  return query
  select
    eo.id, eo.status, eo.revision, eo.shared_at,
    eol.section_id, es.name,
    eol.id, eol.description, eol.quantity, eol.amount, eol.sort_order,
    eol.is_included, eol.unit, eol.unit_price, eol.notes
  from public.event_orders eo
  left join public.event_order_lines eol on eol.event_order_id = eo.id
  left join public.event_order_sections es on es.id = eol.section_id
  where eo.id = v_order.id
  order by eol.sort_order;
end;
$$;

grant execute on function public.get_event_order_for_portal(text) to anon, authenticated;

-- event_order_enabled remains on venues for now but is no longer a product gate.
comment on column public.venues.event_order_enabled is
  'DEPRECATED product gate. Event Order is always available (optional by use). Column retained temporarily; do not use for UI gating.';

notify pgrst, 'reload schema';
