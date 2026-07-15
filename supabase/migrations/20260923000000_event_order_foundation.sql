-- Event Order Foundation — Booking Financial Architecture, Phase 2
--
-- The missing middle layer named across docs/booking-financial-architecture*
-- .md: the single, governed record of what a specific booked Event will
-- actually receive, sitting between the reusable Package/Inventory catalogs
-- and the financial Invoice/Payment Plan documents. Nothing downstream reads
-- from these tables yet in this phase (per the roadmap) — Invoice, Floor
-- Plan, and the couple portal are all repointed in later phases. This
-- migration exists purely to make Event Order real and authorable.
--
-- Scoping note: the original roadmap's "Phase 0" bundled this schema
-- together with columns Phase 3 (invoices.event_order_id) and Phase 6
-- (package_items.unit_price, inventory_items.default_price) will need.
-- Deliberately narrowed here to add only what Phase 2 itself uses — no
-- nullable column should sit unread for two phases before anything
-- consumes it. Those three additions will ship in their own phases' own
-- migrations instead.
--
-- Domain rules encoded below, straight from docs/booking-financial-
-- architecture-event-order-model.md and docs/booking-financial-
-- architecture-sections-and-catalogs.md:
--   * One Event Order per Event (not per Client — Decision 1: Event is the
--     atomic financial unit; a Client with two Events gets two Event
--     Orders).
--   * Lifecycle is Open -> Finalized -> Amended, stored as a two-value
--     status ('open'/'finalized') plus a revision counter rather than a
--     three-value enum — "Amended" is derived (status = 'open' and
--     revision > 0), never stored, so there is nothing for the derived
--     label and the raw state to disagree about.
--   * Sections are optional, ordered, and may point at a specific Floor
--     Plan for later reconciliation (Phase 4) — never required.
--   * Lines carry a frozen quantity/unit_price, copied at commitment from
--     whichever catalog they came from (or typed directly for a custom
--     line) — never a live reference back to packages/inventory_items.
--   * event_order_activities is an append-only audit trail, matching the
--     exact shape (type/title/description) invoice_activities and
--     payment_activities already use — named to match that convention
--     rather than the design docs' own "line_history" working name, since
--     it's the same concept this codebase already has two precedents for.

-- ---- 0. Feature gate ---------------------------------------------------------
-- Same pattern already proven for the Communication Platform migration
-- (venues.conversation_experience_enabled): a venue-level flag, default
-- off, so this entire capability can exist fully built and still be
-- invisible until a venue is deliberately switched onto it.
alter table public.venues add column if not exists event_order_enabled boolean not null default false;

-- ---- 1. event_orders ----------------------------------------------------------
create table public.event_orders (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,

  status        text not null default 'open' check (status in ('open', 'finalized')),
  revision      integer not null default 0 check (revision >= 0),
  finalized_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (event_id)
);

create index event_orders_venue on public.event_orders (venue_id);

create trigger event_orders_updated_at
  before update on public.event_orders
  for each row execute function public.set_updated_at();

-- ---- 2. event_order_sections ---------------------------------------------------
create table public.event_order_sections (
  id            uuid primary key default gen_random_uuid(),
  event_order_id uuid not null references public.event_orders (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,

  name          text not null check (char_length(trim(name)) > 0),
  sort_order    smallint not null default 0,

  -- Optional correspondence to a specific Floor Plan for this event (a
  -- ceremony section reconciled against the ceremony floor plan, not the
  -- whole event's chair count against every floor plan) — additive,
  -- nullable, wired up in Phase 4. set null (not cascade) if that floor
  -- plan is ever deleted — losing the floor plan shouldn't delete the
  -- section or its lines.
  floor_plan_id uuid references public.floor_plans (id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index event_order_sections_order on public.event_order_sections (event_order_id, sort_order);
create index event_order_sections_venue on public.event_order_sections (venue_id);

create trigger event_order_sections_updated_at
  before update on public.event_order_sections
  for each row execute function public.set_updated_at();

-- ---- 3. event_order_lines -------------------------------------------------------
create table public.event_order_lines (
  id              uuid primary key default gen_random_uuid(),
  event_order_id  uuid not null references public.event_orders (id) on delete cascade,
  venue_id        uuid not null references public.venues (id) on delete cascade,

  -- Optional — a booking that never touches Sections keeps every line
  -- here null and gets a flat list, exactly as the design doc requires.
  -- set null (not cascade) on section removal: removing a section must
  -- never delete the commitments recorded on its lines.
  section_id      uuid references public.event_order_sections (id) on delete set null,

  provenance         text not null check (provenance in ('package', 'inventory', 'custom')),
  package_id         uuid references public.packages (id) on delete set null,
  inventory_item_id  uuid references public.inventory_items (id) on delete set null,

  description     text not null check (char_length(trim(description)) > 0),
  quantity        numeric(10,2) not null default 1 check (quantity > 0),
  unit_price      numeric(10,2) not null default 0 check (unit_price >= 0),
  amount          numeric(12,2) not null default 0,

  sort_order      smallint not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index event_order_lines_order on public.event_order_lines (event_order_id, sort_order);
create index event_order_lines_section on public.event_order_lines (section_id) where section_id is not null;
create index event_order_lines_venue on public.event_order_lines (venue_id);

create trigger event_order_lines_updated_at
  before update on public.event_order_lines
  for each row execute function public.set_updated_at();

-- ---- 4. event_order_activities ---------------------------------------------------
create table public.event_order_activities (
  id              uuid primary key default gen_random_uuid(),
  event_order_id  uuid not null references public.event_orders (id) on delete cascade,
  venue_id        uuid not null references public.venues (id) on delete cascade,

  type            text not null,
  title           text not null,
  description     text,

  created_at      timestamptz not null default now()
);

create index event_order_activities_order on public.event_order_activities (event_order_id, created_at desc);

-- ---- RLS -----------------------------------------------------------------------
alter table public.event_orders            enable row level security;
alter table public.event_order_sections    enable row level security;
alter table public.event_order_lines       enable row level security;
alter table public.event_order_activities  enable row level security;

create policy event_orders_all on public.event_orders
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_order_sections_all on public.event_order_sections
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_order_lines_all on public.event_order_lines
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_order_activities_all on public.event_order_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.event_orders            to authenticated;
grant select, insert, update, delete on public.event_order_sections    to authenticated;
grant select, insert, update, delete on public.event_order_lines       to authenticated;
grant select, insert, update, delete on public.event_order_activities  to authenticated;

notify pgrst, 'reload schema';
