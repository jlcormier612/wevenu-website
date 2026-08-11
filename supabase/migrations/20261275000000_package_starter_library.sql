-- Hello to Cheers — Starter Package Library (PKG-01 / PKG-02 / PKG-03)
-- source_master_key for protected masters → independent venue copies.
-- base_price nullable so starters ship unpriced (never fake prices / never $0-as-fake).
-- Does not create invoices, payment plans, or other financial records.

alter table public.packages
  add column if not exists source_master_key text;

comment on column public.packages.source_master_key is
  'Hello to Cheers master key (PKG-01, PKG-02, PKG-03). Venue copies are editable; masters live in code.';

create unique index if not exists packages_venue_source_master_key_uidx
  on public.packages (venue_id, source_master_key)
  where source_master_key is not null;

-- Allow true unpriced catalog rows. Existing rows keep their prices.
alter table public.packages
  alter column base_price drop not null,
  alter column base_price drop default;

alter table public.packages
  drop constraint if exists packages_base_price_check;

alter table public.packages
  add constraint packages_base_price_check
  check (base_price is null or base_price >= 0);

-- Venue-create seed uses the admin/service_role client (same pattern as
-- message / questionnaire / contract / EO / inventory / timeline / floor plan).
grant select, insert, update on public.packages to service_role;
grant select, insert, update on public.package_items to service_role;
