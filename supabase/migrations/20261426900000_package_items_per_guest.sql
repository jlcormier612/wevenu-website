-- A package inclusion can count per guest (e.g. 1 chair per guest). The
-- Event Order line then uses quantity × the event's guest count. Existing
-- inclusions stay fixed counts.

alter table public.package_items
  add column if not exists per_guest boolean not null default false;
