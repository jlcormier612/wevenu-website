-- Coordinator tour availability read — security-definer RPC scoped to
-- current_user_venue_id(), matching get_coordinator_tour_slots.
--
-- Why: table SELECT on tour_availability_windows / exceptions can fail or
-- return empty under grants/RLS that _generate_tour_slots (security definer)
-- still bypasses. A silent empty array hydrates the editor as "all Closed"
-- and makes Save Weekly Availability destructive.
--
-- No venue_id argument: the authenticated session is the only tenant key.
-- Not granted to anon.

create or replace function public.get_coordinator_tour_availability()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  return jsonb_build_object(
    'ok', true,
    'windows', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', w.id,
          'dayOfWeek', w.day_of_week,
          'startTime', substring(w.start_time::text, 1, 5),
          'endTime', substring(w.end_time::text, 1, 5),
          'sortOrder', w.sort_order
        )
        order by w.day_of_week, w.sort_order, w.start_time
      ), '[]'::jsonb)
      from public.tour_availability_windows w
      where w.venue_id = v_venue_id
    ),
    'exceptions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'startDate', e.start_date,
          'endDate', e.end_date,
          'label', e.label
        )
        order by e.start_date
      ), '[]'::jsonb)
      from public.tour_availability_exceptions e
      where e.venue_id = v_venue_id
    )
  );
end;
$$;

revoke all on function public.get_coordinator_tour_availability() from public, anon;
grant execute on function public.get_coordinator_tour_availability() to authenticated;

comment on function public.get_coordinator_tour_availability() is
  'Returns tour availability windows and blocked-date exceptions for the caller''s venue only. Tenant is current_user_venue_id(); there is no venue_id parameter.';
