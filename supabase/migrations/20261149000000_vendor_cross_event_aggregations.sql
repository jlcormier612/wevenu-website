-- Vendor Workspace Realignment (Program 4, Initiative B, 2026-07-22),
-- Phases 6-8: top-level Documents and Timeline are cross-event
-- aggregations, the same idea as the already-existing get_vendor_events()
-- and /vendor/tasks — a vendor fans out across every event they're booked
-- on, one destination instead of opening each event individually. Same
-- SECURITY DEFINER + current_user_vendor_id() pattern as every other
-- vendor-portal read (Sprint 2 Vendor Certification Pass).

create or replace function public.get_vendor_documents()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'eventId', ev.event_id, 'eventName', e.name, 'eventDate', e.event_date, 'venueName', v.name,
          'documents', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
                'id', d.id, 'name', d.name, 'category', d.category,
                'storageUrl', d.storage_url, 'mimeType', d.mime_type, 'notes', d.notes
              ))
              from public.documents d
              where d.event_id = ev.event_id and d.shared_with_vendors = true
            ),
            '[]'::jsonb
          ),
          'floorPlans', coalesce(
            (
              select jsonb_agg(jsonb_build_object('id', fp.id, 'name', fp.name))
              from public.floor_plans fp
              where fp.event_id = ev.event_id and fp.shared_with_vendors = true
            ),
            '[]'::jsonb
          )
        ) order by e.event_date desc nulls last)
        from (select distinct event_id from public.event_vendor_assignments where vendor_id = v_vendor_id) ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_documents() to authenticated;

create or replace function public.get_vendor_timeline()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'eventId', ev.event_id, 'eventName', e.name, 'eventDate', e.event_date, 'venueName', v.name,
          'entries', coalesce(
            (
              select jsonb_agg(jsonb_build_object(
                'id', t.id, 'time', t.entry_time, 'title', t.title, 'description', t.description
              ) order by t.entry_time nulls last)
              from public.timeline_entries t
              where t.event_id = ev.event_id and t.audiences @> array['vendors']
            ),
            '[]'::jsonb
          )
        ) order by e.event_date nulls last)
        from (select distinct event_id from public.event_vendor_assignments where vendor_id = v_vendor_id) ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_timeline() to authenticated;
