-- Event-relative task dues: reinforce days_offset as source of truth for
-- unlocked relative_to_event tasks, recompute due_date from events.event_date
-- (start), and expose days_offset to vendors.
--
-- Product decision: multi-day events always anchor to event_date (start),
-- never event_end_date.

comment on column public.event_tasks.days_offset is
  'Signed days from events.event_date (start). Negative = before, 0 = event day, positive = after. Source of truth for unlocked relative_to_event tasks.';

comment on column public.event_tasks.due_date is
  'Resolved calendar due date (event_date + days_offset for unlocked relative tasks). Used for overdue, reminders, and display; recomputed when event_date changes.';

-- 1) Unlocked relative tasks: recompute due_date from event start + offset
--    so any drift from a moved wedding (or partial updates) is corrected.
update public.event_tasks et
set due_date = (e.event_date + (et.days_offset * interval '1 day'))::date,
    updated_at = now()
from public.events e
where e.id = et.event_id
  and et.due_date_rule_kind = 'relative_to_event'
  and et.due_date_locked = false
  and et.due_date is distinct from (e.event_date + (et.days_offset * interval '1 day'))::date;

-- 2) Locked absolute overrides (and any relative rows that somehow lack a
--    coherent offset): backfill days_offset = due_date - event_date so
--    display can still phrase “N days before” when unlocked later.
update public.event_tasks et
set days_offset = (et.due_date - e.event_date),
    updated_at = now()
from public.events e
where e.id = et.event_id
  and et.due_date is not null
  and e.event_date is not null
  and (
    et.due_date_locked = true
    or et.days_offset is distinct from (et.due_date - e.event_date)
  )
  and et.due_date_locked = true;

-- 3) Vendor event detail: include days_offset + due_date_locked for parity
create or replace function public.get_vendor_event_detail(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_event_id  uuid;
  v_client_id uuid;
begin
  v_vendor_id := current_user_vendor_id();
  if v_vendor_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.event_vendor_assignments
    where id = p_assignment_id and vendor_id = v_vendor_id
  ) then
    return null;
  end if;

  select e.id into v_event_id
  from public.event_vendor_assignments eva
  join public.events e on e.id = eva.event_id
  where eva.id = p_assignment_id;

  select client_id into v_client_id from public.events where id = v_event_id;

  return jsonb_build_object(
    'assignment', (
      select jsonb_build_object(
        'id', eva.id, 'event_id', eva.event_id,
        'arrival_time', eva.arrival_time, 'setup_location', eva.setup_location,
        'load_in_notes', eva.load_in_notes, 'internal_notes', eva.internal_notes,
        'notes', eva.notes, 'checked_in_at', eva.checked_in_at,
        'setup_complete_at', eva.setup_complete_at,
        'share_couple_email', eva.share_couple_email, 'share_couple_phone', eva.share_couple_phone,
        'agreed_fee', eva.agreed_fee, 'payment_status', eva.payment_status
      )
      from public.event_vendor_assignments eva where eva.id = p_assignment_id
    ),
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name,
        'event_date', e.event_date, 'event_end_date', e.event_end_date,
        'event_type', e.event_type,
        'venue_id', e.venue_id, 'venue_name', v.name
      )
      from public.events e
      join public.venues v on v.id = e.venue_id
      where e.id = v_event_id
    ),
    'client', (
      select jsonb_build_object(
        'first_name', c.first_name, 'last_name', c.last_name,
        'partner_first_name', c.partner_first_name, 'partner_last_name', c.partner_last_name,
        'email', c.email, 'phone', c.phone
      )
      from public.clients c where c.id = v_client_id
    ),
    'timeline', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', t.id, 'entry_time', t.entry_time, 'title', t.title,
          'description', t.description, 'audiences', t.audiences
        ) order by t.entry_time nulls last)
        from public.timeline_entries t
        where t.event_id = v_event_id and t.audiences @> array['vendors']
      ),
      '[]'::jsonb
    ),
    'event_tasks', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', et.id, 'title', et.title, 'description', et.description,
          'category', et.category, 'visibility', et.visibility,
          'due_date', et.due_date,
          'days_offset', et.days_offset,
          'due_date_locked', et.due_date_locked,
          'status', et.status, 'is_required', et.is_required, 'completed_at', et.completed_at
        ))
        from public.event_tasks et
        where et.event_id = v_event_id and et.visibility in ('vendor_visible', 'vendor_owned')
      ),
      '[]'::jsonb
    ),
    'documents', coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'id', d.id, 'name', d.name, 'category', d.category,
          'storage_url', d.storage_url, 'mime_type', d.mime_type, 'notes', d.notes,
          'created_at', d.created_at
        ) order by d.created_at desc)
        from public.documents d
        where d.event_id = v_event_id and d.shared_with_vendors = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_event_detail(uuid) to authenticated;
