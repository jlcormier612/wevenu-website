-- Automation P1: tour_completed trigger, per-enrollment pause/resume,
-- activity timeline pause/resume events.
-- Does not alter sequence_enrollments_active_unique or enrollment status values.

-- 1) Tour Completed trigger type on message_sequences
alter table public.message_sequences
  drop constraint if exists message_sequences_trigger_type_check;

alter table public.message_sequences
  add constraint message_sequences_trigger_type_check
  check (trigger_type in ('lead_created', 'lead_stage_changed', 'tour_completed'));

-- 2) Per-enrollment pause (status stays active). resumed_at records the last
-- resume so the existing activity-timeline union can emit automation_resumed
-- after paused_at is cleared.
alter table public.sequence_enrollments
  add column if not exists paused_at timestamptz,
  add column if not exists resumed_at timestamptz;

-- 3) Activity timeline: automation_paused / automation_resumed
create or replace function public.get_relationship_activity_timeline(p_relationship_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
begin
  v_venue_id := current_user_venue_id();
  if v_venue_id is null then
    return '{"error":"unauthorized"}'::jsonb;
  end if;

  if not exists (
    select 1 from public.venue_customer_relationships
    where id = p_relationship_id and venue_id = v_venue_id
  ) then
    return '{"error":"not_found"}'::jsonb;
  end if;

  return jsonb_build_object(
    'events',
    coalesce(
      (
        with
        v_clients as (
          select id from public.clients where relationship_id = p_relationship_id
        ),
        v_events as (
          select id from public.events where client_id in (select id from v_clients)
        ),
        v_conversation as (
          select id from public.conversations where relationship_id = p_relationship_id
        ),
        conversation_gaps as (
          select
            cm.sent_at,
            lag(cm.sent_at) over (order by cm.sent_at) as prev_sent_at
          from public.conversation_messages cm
          where cm.conversation_id in (select id from v_conversation)
        ),
        all_events as (
          select 'lead' as source, la.type, la.title, la.description, la.created_at as occurred_at
            from public.lead_activities la
            where la.lead_id in (select id from public.leads where relationship_id = p_relationship_id)

          union all
          select 'client', ca.type, ca.title, ca.description, ca.created_at
            from public.client_activities ca
            where ca.client_id in (select id from v_clients)

          union all
          select 'event', ea.type, ea.title, ea.description, ea.created_at
            from public.event_activities ea
            where ea.event_id in (select id from v_events)

          union all
          select 'payment', pa.type, pa.title, pa.description, pa.created_at
            from public.payment_activities pa
            where pa.schedule_id in (
              select id from public.payment_schedules where client_id in (select id from v_clients)
            )

          union all
          select 'request', 'request_created', 'Request created: ' || r.title, null, r.created_at
            from public.requests r
            where r.client_id in (select id from v_clients)

          union all
          select 'request', 'request_completed', 'Request completed: ' || r.title, null, r.completed_at
            from public.requests r
            where r.client_id in (select id from v_clients) and r.completed_at is not null

          union all
          select 'contract', 'contract_sent', 'Contract sent: ' || c.title, null, c.sent_at
            from public.contracts c
            where c.client_id in (select id from v_clients) and c.sent_at is not null

          union all
          select 'contract', 'contract_signed', 'Contract signed: ' || c.title, null, c.signed_at
            from public.contracts c
            where c.client_id in (select id from v_clients) and c.signed_at is not null

          union all
          select 'invoice', 'invoice_sent', 'Invoice sent: ' || i.invoice_number, null, i.issued_at
            from public.invoices i
            where i.client_id in (select id from v_clients) and i.issued_at is not null

          union all
          select 'invoice', 'invoice_paid', 'Invoice paid: ' || i.invoice_number, null, i.updated_at
            from public.invoices i
            where i.client_id in (select id from v_clients) and i.status = 'paid'

          union all
          select 'timeline', 'timeline_submitted', 'Timeline submitted', ts.entry_count || ' items', ts.created_at
            from public.timeline_submissions ts
            where ts.client_id in (select id from v_clients)

          union all
          select 'guests', 'guest_count_submitted',
            'Guest count finalized (' || gcs.submitted_count || ' guests)', gcs.note, gcs.created_at
            from public.guest_count_submissions gcs
            where gcs.client_id in (select id from v_clients)

          union all
          select 'vendor', 'vendor_added', 'Vendor added: ' || v.business_name, null, eva.created_at
            from public.event_vendor_assignments eva
            join public.vendors v on v.id = eva.vendor_id
            where eva.event_id in (select id from v_events)

          union all
          select 'conversation',
            case when prev_sent_at is null then 'conversation_started' else 'conversation_resumed' end,
            case when prev_sent_at is null then 'Conversation started' else 'Conversation resumed' end,
            null, sent_at
            from conversation_gaps
            where prev_sent_at is null or sent_at - prev_sent_at > interval '3 days'

          union all
          select 'automation', 'automation_enrolled',
            'Enrolled in automation: ' || coalesce(ms.name, 'Automation'),
            null, se.enrolled_at
            from public.sequence_enrollments se
            left join public.message_sequences ms on ms.id = se.sequence_id
            where se.relationship_id = p_relationship_id
              and se.venue_id = v_venue_id

          union all
          select 'automation', 'automation_paused',
            'Automation paused: ' || coalesce(ms.name, 'Automation'),
            null, se.paused_at
            from public.sequence_enrollments se
            left join public.message_sequences ms on ms.id = se.sequence_id
            where se.relationship_id = p_relationship_id
              and se.venue_id = v_venue_id
              and se.paused_at is not null

          union all
          select 'automation', 'automation_resumed',
            'Automation resumed: ' || coalesce(ms.name, 'Automation'),
            null, se.resumed_at
            from public.sequence_enrollments se
            left join public.message_sequences ms on ms.id = se.sequence_id
            where se.relationship_id = p_relationship_id
              and se.venue_id = v_venue_id
              and se.resumed_at is not null

          union all
          select 'automation',
            case se.status
              when 'completed' then 'automation_completed'
              when 'exited_reply' then 'automation_exited_reply'
              when 'exited_booking' then 'automation_exited_booking'
              when 'exited_lost' then 'automation_exited_lost'
              when 'exited_cancelled' then 'automation_exited_cancelled'
              when 'cancelled' then 'automation_cancelled'
              else 'automation_exited'
            end,
            case se.status
              when 'completed' then 'Automation completed: ' || coalesce(ms.name, 'Automation')
              when 'exited_reply' then 'Automation stopped (replied): ' || coalesce(ms.name, 'Automation')
              when 'exited_booking' then 'Automation stopped (booked): ' || coalesce(ms.name, 'Automation')
              when 'exited_lost' then 'Automation stopped (lost): ' || coalesce(ms.name, 'Automation')
              when 'exited_cancelled' then 'Automation stopped (cancelled): ' || coalesce(ms.name, 'Automation')
              when 'cancelled' then 'Automation cancelled: ' || coalesce(ms.name, 'Automation')
              else 'Automation ended: ' || coalesce(ms.name, 'Automation')
            end,
            null, se.exited_at
            from public.sequence_enrollments se
            left join public.message_sequences ms on ms.id = se.sequence_id
            where se.relationship_id = p_relationship_id
              and se.venue_id = v_venue_id
              and se.status <> 'active'
              and se.exited_at is not null
        )
        select jsonb_agg(
          jsonb_build_object(
            'source', source, 'type', type, 'title', title,
            'description', description, 'occurredAt', occurred_at
          )
          order by occurred_at desc
        )
        from all_events
        where occurred_at is not null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_relationship_activity_timeline(uuid) to authenticated;

notify pgrst, 'reload schema';
