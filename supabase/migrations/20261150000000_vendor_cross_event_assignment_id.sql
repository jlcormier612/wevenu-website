-- get_vendor_documents/get_vendor_timeline (20261149000000) grouped by
-- event_id alone, but /vendor/events/[id] is keyed by assignment_id, not
-- event_id (get_vendor_event_detail's p_assignment_id) — a link built from
-- eventId alone 404s. event_vendor_assignments has a unique (event_id,
-- vendor_id) index, so each grouped event has exactly one assignment for
-- this vendor; expose it alongside eventId so the cross-event Documents and
-- Timeline pages can link to the correct event workspace.

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
          'assignmentId', ev.id, 'eventId', ev.event_id, 'eventName', e.name, 'eventDate', e.event_date, 'venueName', v.name,
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
        from public.event_vendor_assignments ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
        where ev.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

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
          'assignmentId', ev.id, 'eventId', ev.event_id, 'eventName', e.name, 'eventDate', e.event_date, 'venueName', v.name,
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
        from public.event_vendor_assignments ev
        join public.events e on e.id = ev.event_id
        join public.venues v on v.id = e.venue_id
        where ev.vendor_id = v_vendor_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;
