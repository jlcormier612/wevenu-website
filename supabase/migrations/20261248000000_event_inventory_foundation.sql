-- Work Package D5 — Event Inventory Foundation.
--
-- The one real new business capability this phase is authorized to build
-- (D3 finding, restated in D5's own brief): "There is no per-event Working
-- Inventory today." `inventory_items`/`inventory_categories` remain the
-- venue-wide Master Catalog ("what do we offer/own?") — untouched by this
-- migration. This adds the missing middle layer: what's actually selected
-- for THIS event ("what's being used for this event?"), plus a reusable
-- Inventory Template layer following the exact same Library → Working Item
-- shape D2 already established for Contracts (contract_templates →
-- contracts) and this codebase's own Event Order foundation
-- (20260923000000_event_order_foundation.sql) — same pattern, fourth
-- domain, not a new one.
--
-- Architecture note (D5 brief §1, §16): Inventory is "operational
-- structured data," not a Document — it does not go through the certified
-- Document Domain (canonical_documents/versions/representations). Its
-- category match is Event Order (an "operational business record"), so its
-- lifecycle mirrors Event Order's open/finalized model almost exactly —
-- same table shape, same RLS pattern, same append-only activity log.
--
-- Snapshot discipline (D5 brief §7): `inventory_items` has no price field
-- at all (confirmed — deferred to a future "Phase 6" that hasn't shipped).
-- So `name`/`category`/`unit_price` are captured directly on each Event
-- Inventory item at add-time, not looked up live from the catalog on every
-- read — the same "copy at commitment, never a live reference" rule Event
-- Order already applies to Package/Inventory-provenance lines. If the
-- master catalog's name or the venue's category list changes later, an
-- event that already agreed to specific items keeps exactly what it
-- agreed to.

-- ---- 1. inventory_templates ----------------------------------------------------
-- The Library-side reusable grouping (D5 brief §9: "Wedding Reception
-- Inventory," "Ceremony Inventory," etc).
create table public.inventory_templates (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,

  name          text not null check (char_length(trim(name)) > 0),
  description   text,
  is_archived   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index inventory_templates_venue on public.inventory_templates (venue_id);

create trigger inventory_templates_updated_at
  before update on public.inventory_templates
  for each row execute function public.set_updated_at();

create table public.inventory_template_items (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.inventory_templates (id) on delete cascade,
  venue_id          uuid not null references public.venues (id) on delete cascade,

  -- Optional provenance back to the Master Catalog — set null (not
  -- cascade) if that catalog item is later deleted; the template keeps its
  -- own name/category copy regardless (same snapshot rule as the working
  -- item below, so a template survives catalog cleanup unchanged).
  inventory_item_id uuid references public.inventory_items (id) on delete set null,

  name              text not null check (char_length(trim(name)) > 0),
  category          text,
  quantity          numeric(10,2) not null default 1 check (quantity > 0),
  unit_price        numeric(10,2) check (unit_price is null or unit_price >= 0),
  is_included       boolean not null default true,
  notes             text,
  sort_order        smallint not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index inventory_template_items_order on public.inventory_template_items (template_id, sort_order);
create index inventory_template_items_venue on public.inventory_template_items (venue_id);

create trigger inventory_template_items_updated_at
  before update on public.inventory_template_items
  for each row execute function public.set_updated_at();

-- ---- 2. event_inventory ----------------------------------------------------------
-- One Working Inventory per Event (same "Event is the atomic unit" decision
-- Event Order already made) — not per Client, so a Client with two Events
-- gets two independent Event Inventories.
create table public.event_inventory (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,

  -- Provenance only — which template this started from, if any. Never a
  -- live reference; editing the template after this point never touches
  -- an already-created Event Inventory (D5 brief §10, validated in §16 below).
  template_id   uuid references public.inventory_templates (id) on delete set null,

  -- draft: venue is building it, no one else can see it.
  -- shared: venue has explicitly made it client-viewable (read-only —
  --   D5 brief §11/§12 judgment call: no existing product precedent for
  --   client-editable structured data outside Guest Count Submission and
  --   the Questionnaire, both purpose-built collaborative flows; this
  --   phase does not invent a third such surface for Inventory).
  -- finalized: agreed values are locked (enforced below, not just labeled).
  status        text not null default 'draft' check (status in ('draft', 'shared', 'finalized')),
  finalized_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (event_id)
);

create index event_inventory_venue on public.event_inventory (venue_id);

create trigger event_inventory_updated_at
  before update on public.event_inventory
  for each row execute function public.set_updated_at();

create table public.event_inventory_items (
  id                  uuid primary key default gen_random_uuid(),
  event_inventory_id  uuid not null references public.event_inventory (id) on delete cascade,
  venue_id            uuid not null references public.venues (id) on delete cascade,

  inventory_item_id   uuid references public.inventory_items (id) on delete set null,

  name                text not null check (char_length(trim(name)) > 0),
  category            text,
  quantity            numeric(10,2) not null default 1 check (quantity > 0),
  unit_price          numeric(10,2) check (unit_price is null or unit_price >= 0),
  is_included         boolean not null default true,
  notes               text,
  sort_order          smallint not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index event_inventory_items_order on public.event_inventory_items (event_inventory_id, sort_order);
create index event_inventory_items_venue on public.event_inventory_items (venue_id);

create trigger event_inventory_items_updated_at
  before update on public.event_inventory_items
  for each row execute function public.set_updated_at();

create table public.event_inventory_activities (
  id                  uuid primary key default gen_random_uuid(),
  event_inventory_id  uuid not null references public.event_inventory (id) on delete cascade,
  venue_id            uuid not null references public.venues (id) on delete cascade,

  type                text not null,
  title               text not null,
  description         text,

  created_at          timestamptz not null default now()
);

create index event_inventory_activities_order on public.event_inventory_activities (event_inventory_id, created_at desc);

-- ---- 3. Finalization immutability (D5 brief §16/§39) ------------------------------
-- "Test that the finalized state cannot be silently mutated." Event Order's
-- own equivalent (assertOpen()) is app-layer only; D4 already found that
-- app-only enforcement is a real, exploitable gap for exactly this kind of
-- claim, so this one is enforced at the database level from the start —
-- the same trigger-based pattern D4 added for canonical_document_versions
-- (20261246000000_document_version_lock_immutability.sql), applied here
-- directly since Event Inventory isn't a Document Domain artifact.
create or replace function public.event_inventory_items_enforce_finalized_immutability()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.event_inventory where id = coalesce(new.event_inventory_id, old.event_inventory_id);
  if v_status = 'finalized' then
    raise exception 'This Event Inventory is finalized — reopen it to make changes.'
      using errcode = '23001'; -- restrict_violation
  end if;
  return coalesce(new, old);
end;
$$;

create trigger event_inventory_items_finalized_immutable
  before insert or update or delete on public.event_inventory_items
  for each row execute function public.event_inventory_items_enforce_finalized_immutability();

-- ---- RLS -----------------------------------------------------------------------
alter table public.inventory_templates       enable row level security;
alter table public.inventory_template_items  enable row level security;
alter table public.event_inventory           enable row level security;
alter table public.event_inventory_items     enable row level security;
alter table public.event_inventory_activities enable row level security;

create policy inventory_templates_all on public.inventory_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy inventory_template_items_all on public.inventory_template_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_inventory_all on public.event_inventory
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_inventory_items_all on public.event_inventory_items
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy event_inventory_activities_all on public.event_inventory_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.inventory_templates        to authenticated;
grant select, insert, update, delete on public.inventory_template_items   to authenticated;
grant select, insert, update, delete on public.event_inventory            to authenticated;
grant select, insert, update, delete on public.event_inventory_items      to authenticated;
grant select, insert, update, delete on public.event_inventory_activities to authenticated;

-- ---- 4. Client read-only visibility (D5 brief §11/§12) --------------------------
-- Client Portal access is via the SECURITY DEFINER couple-portal RPC layer
-- (same as every other client-facing surface in this codebase — e.g.
-- submit_guest_count() above, resolved through client_portal_sessions —
-- none of them grant the anon/authenticated-couple role direct table
-- access). No grant to anon/couple roles here; the read path is a new RPC,
-- scoped to status = 'shared' or 'finalized' only (never 'draft'), and to
-- whichever event the session's own client actually owns (never an
-- arbitrary p_event_id — the session resolves both facts itself).
create or replace function public.get_event_inventory_for_portal(p_token text)
returns table (
  id           uuid,
  status       text,
  finalized_at timestamptz,
  item_id      uuid,
  item_name    text,
  item_category text,
  item_quantity numeric,
  item_unit_price numeric,
  item_is_included boolean,
  item_notes   text,
  item_sort_order smallint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return; end if;

  return query
  select
    ei.id, ei.status, ei.finalized_at,
    eii.id, eii.name, eii.category, eii.quantity, eii.unit_price, eii.is_included, eii.notes, eii.sort_order
  from public.event_inventory ei
  join public.events e on e.id = ei.event_id
  left join public.event_inventory_items eii on eii.event_inventory_id = ei.id
  where e.client_id = v_session.client_id
    and ei.venue_id = v_session.venue_id
    and ei.status in ('shared', 'finalized')
  order by eii.sort_order;
end;
$$;

grant execute on function public.get_event_inventory_for_portal(text) to anon, authenticated;

notify pgrst, 'reload schema';
