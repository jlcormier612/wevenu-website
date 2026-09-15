-- Vendor Network recovery: restore service_role table privileges needed for
-- ops verification (check-in notification content, vendor_tasks smoke).
-- Authenticated RLS policies are unchanged — venue staff still use their
-- existing policies / get_venue_notifications RPC.

grant select on public.venue_notifications to service_role;
grant select, insert, update on public.vendor_tasks to service_role;

-- Re-assert check-in notification uses vendors.business_name (idempotent).
create or replace function public._trigger_vendor_checkin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_name text;
begin
  if OLD.checked_in_at is not null then return NEW; end if;
  if NEW.checked_in_at is null then return NEW; end if;

  select business_name into v_vendor_name
  from public.vendors
  where id = NEW.vendor_id;

  perform public.create_venue_notification(
    NEW.venue_id,
    NEW.event_id,
    'vendor_checked_in',
    coalesce(v_vendor_name, 'Vendor') || ' has arrived',
    'Checked in and ready for setup',
    '/events/' || NEW.event_id::text || '/today',
    '🤝'
  );

  return NEW;
end;
$$;

notify pgrst, 'reload schema';
