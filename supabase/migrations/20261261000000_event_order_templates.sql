-- Work Package D7A — Event Order Templates.
--
-- Confirmed before writing this (docs/event-order-operational-experience-
-- implementation.md §24-25, and this phase's own research pass): this was
-- previously a deliberate, documented gap ("no established requirement
-- forced it"), not an oversight. D7 is that explicit requirement. Follows
-- the exact "Library `*_templates` table + copy-at-commitment Working
-- Item" shape already established twice — contract_templates→contracts
-- and inventory_templates/inventory_template_items→event_inventory/
-- event_inventory_items (20261248000000_event_inventory_foundation.sql,
-- the closer sibling: Event-scoped, multi-row child items).
--
-- Boundary (brief §31/§33): a template stores only reusable STRUCTURE —
-- section names and standard line description/quantity/price — never a
-- live reference to a Package or Inventory item, and never anything
-- event-specific (client, date, guest count, floor plan). Applying a
-- template copies its structure into the real event_order_sections/
-- event_order_lines tables via the exact same sanctioned insert functions
-- (lib/event-orders/repository.ts: insertSection/insertCustomLine) every
-- other line-adding path already uses — no second line-insertion
-- mechanism, no template-layer pricing/total calculation.

create table public.event_order_templates (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,

  name          text not null check (char_length(trim(name)) > 0),
  description   text,
  is_archived   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index event_order_templates_venue on public.event_order_templates (venue_id);

create trigger event_order_templates_updated_at
  before update on public.event_order_templates
  for each row execute function public.set_updated_at();

create table public.event_order_template_sections (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.event_order_templates (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,

  name          text not null check (char_length(trim(name)) > 0),
  sort_order    smallint not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index event_order_template_sections_order on public.event_order_template_sections (template_id, sort_order);
create index event_order_template_sections_venue on public.event_order_template_sections (venue_id);

create trigger event_order_template_sections_updated_at
  before update on public.event_order_template_sections
  for each row execute function public.set_updated_at();

create table public.event_order_template_lines (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.event_order_templates (id) on delete cascade,
  venue_id      uuid not null references public.venues (id) on delete cascade,

  -- null (not a foreign FK to a live catalog row) on purpose — a template
  -- line is a standard description/quantity/price the venue wants to start
  -- from, never a live Package/Inventory reference (brief §37/§57: never
  -- duplicate inventory pricing or calculate totals in the template layer).
  section_id    uuid references public.event_order_template_sections (id) on delete set null,

  description   text not null check (char_length(trim(description)) > 0),
  quantity      numeric(10,2) not null default 1 check (quantity > 0),
  unit_price    numeric(10,2) not null default 0 check (unit_price >= 0),
  sort_order    smallint not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index event_order_template_lines_order on public.event_order_template_lines (template_id, sort_order);
create index event_order_template_lines_venue on public.event_order_template_lines (venue_id);

create trigger event_order_template_lines_updated_at
  before update on public.event_order_template_lines
  for each row execute function public.set_updated_at();

-- Provenance only, exactly matching event_inventory.template_id's own
-- comment: never a live reference — editing the template after this point
-- never touches an already-created Event Order (verified live, see
-- docs/library-remaining-capabilities-implementation.md §7).
alter table public.event_orders
  add column template_id uuid references public.event_order_templates (id) on delete set null;

-- ---- RLS -----------------------------------------------------------------------
alter table public.event_order_templates          enable row level security;
alter table public.event_order_template_sections  enable row level security;
alter table public.event_order_template_lines     enable row level security;

create policy event_order_templates_all on public.event_order_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_order_template_sections_all on public.event_order_template_sections
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_order_template_lines_all on public.event_order_template_lines
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- D6/D2 lesson applied from day one this time (brief §45: "D7 must not
-- reproduce that inconsistency") — RESTRICTIVE, Owner/Manager only, same
-- exact shape as contract_templates_delete_gate/playbook_templates_delete_gate.
-- Deliberately only on the template itself, not its sections/lines — any
-- of the four venue roles can author template content, matching Event
-- Order's own looser posture (research confirmed: event_orders/sections/
-- lines have zero role differentiation today); only permanently removing
-- the reusable template is gated.
create policy event_order_templates_delete_gate on public.event_order_templates
  as restrictive
  for delete
  using (current_user_role() = any (array['owner', 'manager']));

grant select, insert, update, delete on public.event_order_templates         to authenticated;
grant select, insert, update, delete on public.event_order_template_sections to authenticated;
grant select, insert, update, delete on public.event_order_template_lines    to authenticated;

notify pgrst, 'reload schema';
