-- ============================================================================
-- RC2 — Messaging & Conversations, Milestone 4: Activity Timeline.
--
-- "Make Activity Timeline read like an audit trail, not a chat log." A
-- coordinator opening a relationship six months later should see what
-- happened (Lead received, Tour scheduled, Contract signed, Vendor added,
-- Payment received, Conversation started/resumed...), not a raw dump of
-- every message. The Conversation answers "what was said"; this answers
-- "what happened."
--
-- No new activity-logging table. Every business milestone already has a
-- home somewhere in the schema (lead_activities, client_activities,
-- event_activities, payment_activities, requests, contracts,
-- timeline_submissions, guest_count_submissions, event_vendor_assignments) —
-- this is a read-only composed query over those sources, re-run fresh on
-- every read, exactly as docs/conversation-lifecycle-design.md originally
-- specified this feature. Conversation activity is deliberately NOT one row
-- per message — it's collapsed into "Conversation started" / "Conversation
-- resumed" narrative markers (a 3+ day gap since the last message), which
-- is the one new derivation this migration adds.
-- ============================================================================

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
        -- Conversation activity, collapsed to narrative markers — never one
        -- row per message. A gap of 3+ days (or no prior message at all)
        -- reads as a new beat in the relationship's story.
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

          -- invoices has no dedicated "paid at" column or payment-transaction
          -- ledger (unlike payment_schedules/payment_activities above) — this
          -- is the best available signal, using updated_at as an
          -- approximation. A rare false trigger (someone edits a paid
          -- invoice's notes) is an acceptable, disclosed tradeoff rather
          -- than adding a new column for this one branch.
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
