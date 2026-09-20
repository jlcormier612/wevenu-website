-- Public availability calendar.
--
-- Customer-facing dates use the same date-level authority as the inquiry
-- form: public._is_event_date_available. That function refuses a date when
-- a full-day event would be refused — booked-event occupancy (including
-- turnaround and multi-space capacity) or a calendar block that covers the
-- day. Tours, appointments, and date holds do not close a date unless they
-- are already represented as a covering availability block.
--
-- The function returns venue branding and available dates only. It does not
-- return events, clients, holds, notes, or staff.

create or replace function public.get_public_availability_calendar(
  p_embed_key text,
  p_start     date,
  p_end       date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues%rowtype;
  v_dates date[] := '{}';
  v_cur   date;
begin
  if p_embed_key is null or length(trim(p_embed_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  select * into v_venue
  from public.venues
  where embed_key = p_embed_key;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_key');
  end if;

  if p_start is null or p_end is null or p_end < p_start
     or (p_end - p_start) > 62 then
    return jsonb_build_object('ok', false, 'error', 'invalid_range');
  end if;

  v_cur := p_start;
  while v_cur <= p_end loop
    if public._is_event_date_available(v_venue.id, v_cur) then
      v_dates := array_append(v_dates, v_cur);
    end if;
    v_cur := v_cur + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'venue', jsonb_build_object(
      'name', v_venue.name,
      'logoUrl', v_venue.logo_url,
      'primaryColor', coalesce(v_venue.primary_color, '#5D6F5D'),
      'timezone', coalesce(nullif(v_venue.timezone, ''), 'America/New_York')
    ),
    'dates', to_jsonb(v_dates)
  );
end;
$$;

revoke all on function public.get_public_availability_calendar(text, date, date) from public;
grant execute on function public.get_public_availability_calendar(text, date, date) to anon, authenticated;

notify pgrst, 'reload schema';
