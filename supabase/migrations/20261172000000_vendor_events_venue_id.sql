-- ============================================================================
-- Richer vendor Dashboard hero (2026-07-24) — "Upcoming Events" and "Next
-- Event" need to be scoped to the active venue, not the vendor's whole
-- cross-venue event list. get_vendor_events returned venue_name but not
-- venue_id, so the only way to scope by venue client-side would have been
-- fragile string-matching on venue_name. Purely additive field — no
-- existing consumer's shape changes, just gains one more key.
-- ============================================================================

create or replace function public.get_vendor_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_today date := current_date;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'assignment_id', eva.id, 'event_id', e.id, 'event_name', e.name,
          'event_date', e.event_date, 'venue_id', v.id, 'venue_name', v.name,
          'arrival_time', eva.arrival_time,
          'is_upcoming', (e.event_date is not null and e.event_date >= v_today)
        ) order by e.event_date desc nulls last)
        from public.event_vendor_assignments eva
        join public.events e on e.id = eva.event_id
        join public.venues v on v.id = e.venue_id
        where eva.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_events() to authenticated;
