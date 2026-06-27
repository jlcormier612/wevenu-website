-- ============================================================================
-- Sprint 24 — Package Inclusions & Percentage Discounts
--
-- Two additive changes:
--   package_items        — itemized inclusions within a package
--   invoice_line_items   — discount_type + discount_value for % discounts
-- ============================================================================

-- package_items ---------------------------------------------------------------
-- Itemized list of what's included in a package. Purely descriptive for V1 —
-- inclusions appear on the package detail page and will flow into invoice print
-- and contract templates in future sprints.
create table public.package_items (
  id          uuid primary key default gen_random_uuid(),
  package_id  uuid not null references public.packages (id) on delete cascade,
  venue_id    uuid not null references public.venues   (id) on delete cascade,
  description text not null,
  quantity    numeric(6, 2) not null default 1,
  unit        text,           -- "guests", "hours", "items", optional
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  check (char_length(trim(description)) > 0)
);

create index package_items_package on public.package_items (package_id, sort_order);

-- Percentage discount support on invoice_line_items ---------------------------
-- discount_type:  'fixed'   — amount is the literal dollar value
--                 'percent' — amount was computed as (subtotal × discount_value / 100)
--                             stored at the time the discount was added
-- discount_value: the raw % or fixed value entered by the user (informational)
alter table public.invoice_line_items
  add column discount_type  text check (discount_type  in ('fixed', 'percent')),
  add column discount_value numeric(10, 4);

-- RLS on package_items --------------------------------------------------------
alter table public.package_items enable row level security;

create policy package_items_all on public.package_items
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.package_items to authenticated;

notify pgrst, 'reload schema';
