-- ============================================================================
-- Sprint 22 — Packages, Invoices & Smart Payment Plans
--
-- Establishes the financial workflow foundation:
--   Packages → Invoice (line items) → Payment Plan → Payments
--
-- Five additions:
--   packages              — venue catalog items
--   invoices              — source of truth for amounts owed
--   invoice_line_items    — package picks, add-ons, taxes, discounts
--   invoice_activities    — audit trail
--   payment_schedules.invoice_id — links a plan to its invoice
-- ============================================================================

-- packages --------------------------------------------------------------------
-- Flat catalog of offerings the venue sells. A package can be picked as a
-- line item on an invoice. V1 is intentionally flat — package_items (contents
-- within a package) will be a Sprint 23+ addition.
create table public.packages (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,
  description text,
  base_price  numeric(10, 2) not null default 0 check (base_price >= 0),
  category    text,       -- freeform: "Venue", "Catering", "Floral", etc.
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (char_length(trim(name)) > 0)
);

create index packages_venue on public.packages (venue_id, sort_order, name);

create trigger packages_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

-- invoices --------------------------------------------------------------------
-- One invoice per client/event pair (not enforced — venues may issue multiple).
-- Invoice is the source of truth for total amount owed.
-- balance_due is set to total on creation; updated when payments are received.
create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues  (id) on delete cascade,
  client_id        uuid          references public.clients (id) on delete set null,
  event_id         uuid          references public.events  (id) on delete set null,
  invoice_number   text not null,         -- e.g. "INV-2026-A3F2"
  status           text not null default 'draft'
                     check (status in ('draft', 'sent', 'paid', 'void')),
  subtotal         numeric(10, 2) not null default 0,
  discount_amount  numeric(10, 2) not null default 0,
  tax_amount       numeric(10, 2) not null default 0,
  total            numeric(10, 2) not null default 0,
  balance_due      numeric(10, 2) not null default 0,
  notes            text,
  due_date         date,
  issued_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index invoices_venue  on public.invoices (venue_id, created_at desc);
create index invoices_client on public.invoices (client_id) where client_id is not null;
create index invoices_event  on public.invoices (event_id)  where event_id  is not null;

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- invoice_line_items ----------------------------------------------------------
-- Individual line items on an invoice. Types map to QBO account categories
-- for future accounting sync (see memory: accounting-integration).
-- amount = quantity × unit_price (computed by app, stored for query efficiency).
create table public.invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices  (id) on delete cascade,
  venue_id    uuid not null references public.venues    (id) on delete cascade,
  package_id  uuid          references public.packages  (id) on delete set null,
  type        text not null default 'item'
                check (type in ('package', 'addon', 'inventory',
                                'discount', 'fee', 'tax', 'deposit', 'item')),
  description text not null,
  quantity    numeric(8, 2) not null default 1,
  unit_price  numeric(10, 2) not null default 0,
  amount      numeric(10, 2) not null default 0,  -- quantity × unit_price
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  check (char_length(trim(description)) > 0)
);

create index invoice_line_items_invoice on public.invoice_line_items (invoice_id, sort_order);

-- invoice_activities ----------------------------------------------------------
create table public.invoice_activities (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues  (id) on delete cascade,
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  type        text not null,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create index invoice_activities_invoice on public.invoice_activities (invoice_id, created_at desc);

-- Link payment schedules to invoices (additive, non-breaking) -----------------
alter table public.payment_schedules
  add column invoice_id uuid references public.invoices (id) on delete set null;

create index payment_schedules_invoice on public.payment_schedules (invoice_id)
  where invoice_id is not null;

-- RLS -------------------------------------------------------------------------
alter table public.packages           enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_activities enable row level security;

create policy packages_all on public.packages
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy invoices_all on public.invoices
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy invoice_line_items_all on public.invoice_line_items
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy invoice_activities_all on public.invoice_activities
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.packages           to authenticated;
grant select, insert, update, delete on public.invoices           to authenticated;
grant select, insert, update, delete on public.invoice_line_items to authenticated;
grant select, insert, update, delete on public.invoice_activities to authenticated;

notify pgrst, 'reload schema';
