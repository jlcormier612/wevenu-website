-- Sales owner and event owner must be an active member of the same venue.
-- The foreign key only checks that the id exists on venue_staff. A direct
-- client update could otherwise point a Fancy lead at another venue's staff.

create or replace function public.reject_cross_venue_staff_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  staff_venue uuid;
  staff_active boolean;
begin
  if NEW.assigned_staff_id is null then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.assigned_staff_id is not distinct from OLD.assigned_staff_id then
    return NEW;
  end if;
  select venue_id, is_active
    into staff_venue, staff_active
  from public.venue_staff
  where id = NEW.assigned_staff_id;
  if staff_venue is null
     or staff_venue is distinct from NEW.venue_id
     or staff_active is distinct from true then
    raise exception 'assigned staff must be an active member of this venue'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

drop trigger if exists leads_assigned_staff_venue_guard on public.leads;
create trigger leads_assigned_staff_venue_guard
  before insert or update of assigned_staff_id on public.leads
  for each row
  execute function public.reject_cross_venue_staff_assignment();

drop trigger if exists events_assigned_staff_venue_guard on public.events;
create trigger events_assigned_staff_venue_guard
  before insert or update of assigned_staff_id on public.events
  for each row
  execute function public.reject_cross_venue_staff_assignment();
