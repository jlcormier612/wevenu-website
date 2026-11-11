-- Package inclusions can point at a catalog Offering. Text stays the display
-- fallback; existing inclusions keep offering_id null and behave as before.

alter table public.package_items
  add column if not exists offering_id uuid references public.offerings (id) on delete set null;

create index if not exists package_items_offering on public.package_items (offering_id)
  where offering_id is not null;

create or replace function public.package_items_offering_same_venue()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.offering_id is not null and not exists (
    select 1 from public.offerings o
    where o.id = new.offering_id and o.venue_id = new.venue_id
  ) then
    raise exception 'offering_not_in_venue' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists package_items_offering_same_venue on public.package_items;
create trigger package_items_offering_same_venue
  before insert or update of offering_id, venue_id on public.package_items
  for each row execute function public.package_items_offering_same_venue();

notify pgrst, 'reload schema';
