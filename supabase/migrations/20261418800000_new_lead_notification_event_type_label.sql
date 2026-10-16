-- New-lead staff notification body: show canonical event-type labels
-- (Wedding, Corporate Event, …) instead of raw stored keys (wedding).
-- Presentation only — does not change leads.event_type storage.

create or replace function public.event_type_display_label(p_value text)
returns text
language sql
immutable
as $$
  select case public.normalize_event_type(p_value)
    when 'wedding' then 'Wedding'
    when 'elopement' then 'Elopement'
    when 'engagement_party' then 'Engagement Party'
    when 'rehearsal_dinner' then 'Rehearsal Dinner Only'
    when 'reception' then 'Reception Only'
    when 'corporate' then 'Corporate Event'
    when 'social_event' then 'Social Event'
    when 'birthday' then 'Birthday Party'
    when 'anniversary' then 'Anniversary Celebration'
    when 'shower' then 'Bridal / Baby Shower'
    when 'gala' then 'Gala / Fundraiser'
    when 'retreat' then 'Retreat'
    when 'celebration_of_life' then 'Celebration of Life'
    when 'quinceanera' then 'Quinceañera'
    when 'other' then 'Other'
    else nullif(trim(coalesce(p_value, '')), '')
  end;
$$;

comment on function public.event_type_display_label(text) is
  'Human-readable event-type label for notifications and customer-facing copy. Storage stays on normalize_event_type keys.';

create or replace function public._trigger_new_lead_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type_label text;
begin
  if NEW.is_historical_import then
    return NEW;
  end if;
  if NEW.sales_stage is not distinct from 'booked' then
    return NEW;
  end if;

  v_type_label := coalesce(
    public.event_type_display_label(NEW.event_type),
    'Event inquiry'
  );

  perform public.create_venue_notification(
    NEW.venue_id,
    null,
    'new_lead',
    'New inquiry from ' || NEW.first_name || coalesce(' ' || NEW.last_name, ''),
    v_type_label
      || case when NEW.event_date is not null
              then ' · ' || to_char(NEW.event_date, 'Mon DD, YYYY')
              else '' end,
    '/leads/' || NEW.id::text,
    '✨'
  );
  return NEW;
end;
$$;
