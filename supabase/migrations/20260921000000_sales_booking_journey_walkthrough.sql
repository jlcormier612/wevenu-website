-- Sales → Booking Journey — operational walkthrough.
--
-- Found by actually walking the flow, not by reading code: submitting a
-- real public inquiry and following the resulting "New inquiry from X"
-- notification landed on the Leads list, not the new lead's own record —
-- the trigger hardcoded '/leads' as the link even though the new lead's
-- id is right there on NEW. Every other notification trigger in this
-- platform (message_received, task_completed, etc.) already deep-links to
-- the specific record; this one just never had that same care applied.

create or replace function public._trigger_new_lead_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_venue_notification(
    NEW.venue_id,
    null,
    'new_lead',
    'New inquiry from ' || NEW.first_name || coalesce(' ' || NEW.last_name, ''),
    coalesce(NEW.event_type, 'Event inquiry')
      || case when NEW.event_date is not null
              then ' · ' || to_char(NEW.event_date, 'Mon DD, YYYY')
              else '' end,
    '/leads/' || NEW.id::text,
    '✨'
  );
  return NEW;
end;
$$;
