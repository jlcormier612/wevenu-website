-- ============================================================================
-- Sprint 2, Phase 2 — Vendor Payment Visibility.
--
-- Deliberately scoped as a summary, not an accounting module (explicit
-- decision): a vendor needs to know "What am I being paid?" and "Has it
-- been paid?" — nothing else. No installments, no refunds, no activity
-- log, no ACH/Stripe integration. That's the couple-side payment_line_items
-- system's job for a later, separate accounting initiative; this is two
-- fields on the assignment the venue already manages.
-- ============================================================================

alter table public.event_vendor_assignments
  add column agreed_fee numeric,
  add column payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid'));

-- ── get_vendor_event_detail now includes the vendor's own payment summary ──

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
        'id', e.id, 'name', e.name, 'event_date', e.event_date, 'event_type', e.event_type,
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
          'category', et.category, 'visibility', et.visibility, 'due_date', et.due_date,
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
          'storage_url', d.storage_url, 'mime_type', d.mime_type, 'notes', d.notes
        ))
        from public.documents d
        where d.event_id = v_event_id and d.shared_with_vendors = true
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_vendor_event_detail(uuid) to authenticated;

notify pgrst, 'reload schema';
