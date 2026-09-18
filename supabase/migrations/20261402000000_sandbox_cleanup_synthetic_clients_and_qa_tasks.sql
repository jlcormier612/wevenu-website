-- Sandbox: remove synthetic E2E / QA client+task fixtures contaminating
-- Clients, Payments, Inbox, Contracts, and Dashboard Today's Focus.
-- Idempotent. Scoped to Jen's Fancy Sandbox only.
-- Does NOT delete protected realistic release-readiness personas
-- (Cindy, Lydia, Emma, Ellie, Kendra, Jess, Alison, Megan, etc.).

do $$
declare
  v_venue uuid := 'a415ac52-cd74-42a6-8df7-7a8f6e71d080';
  v_client_ids uuid[];
  v_rel_ids uuid[];
  v_convo_ids uuid[];
  v_event_ids uuid[];
  v_contract_ids uuid[];
  v_invoice_ids uuid[];
  v_schedule_ids uuid[];
  v_task_ids uuid[] := array[
    '950b38a7-86e2-4061-9fc2-b91d51110bc0'::uuid, -- QA Wiring — follow up Cindy proposal
    '131302b6-4f56-41ba-b514-92ab983cfa20'::uuid, -- Check in if no response — edited verify
    'a761ae11-b340-453d-96fe-02124ef71349'::uuid, -- Call about guest count — lead complete sync
    'c58aa1f9-2988-4901-a78c-6a216c2fe9ae'::uuid  -- Send revised pricing packet — snapshot verify
  ];
  -- Synthetic clients (E2E / cancel-ledger / Wedding ThisMonth / orphan SpineE2E).
  -- Explicitly NOT including: Cindy, Ellie, Megan, Colby SpineE2E3 (Emma lead),
  -- Colby Yagnesak, Ron Cormier, Buppy Robicheau.
  v_synth_clients uuid[] := array[
    '3d850c19-9719-4da0-84bc-765c4db05904'::uuid, -- E2EFullClient…@example.com
    'a3ed0cfe-a691-46f4-8b03-82068e53cf83'::uuid, -- E2EFullClient2…@example.com
    '12a66575-9271-4d94-8ac5-ea34f95527bd'::uuid, -- E2ENoEmail…
    'd8030e02-d918-4882-88db-2d84c77c22ab'::uuid, -- E2EClient… / htc.invoice.smoke
    'd4cd3c08-f69b-4272-b83e-d209fbacafec'::uuid, -- E2ETest… Lead
    '0419053a-58a8-4adc-990c-d1cdffdbb134'::uuid, -- Cancel Ledger 930c6ab3
    'c34da823-08a5-4662-b46f-3c5aeb21232c'::uuid, -- Cancel Ledger f673829e
    'acc0ee53-e34c-447b-ab54-fb1f4a44efa2'::uuid, -- Cancel Ledger 98aeb776
    '3b354406-9da4-46b9-b921-a16f3a85a724'::uuid, -- Cancel Ledger 379c1e6f
    '9435bf82-c387-4808-b959-bbc884c024d0'::uuid, -- Cancel Ledger cac6d753
    '4ec5ccb8-9eee-442b-9c23-a7be3b937b9a'::uuid, -- Cancel Ledger d9e0a0f5
    'ca72f106-1094-4bec-8c99-3a42c4babf7a'::uuid, -- Cancel Ledger ebf94394
    '7fd4f4ff-ad9c-490b-b4d0-bb3f3ea30ece'::uuid, -- Wedding ThisMonth…
    'b5e13bd5-6093-4a09-aec8-5a06376d2efd'::uuid  -- Colby SpineE2E (no protected lead)
  ];
begin
  if not exists (select 1 from public.venues where id = v_venue) then
    raise notice 'Sandbox venue absent — nothing to clean.';
    return;
  end if;

  -- 1) QA / synthetic lead_tasks (Today's Focus contamination)
  delete from public.lead_tasks
  where venue_id = v_venue
    and id = any (v_task_ids);

  -- Also catch any remaining incomplete tasks with explicit QA/verify titles
  -- on this venue only (title markers — not a broad name wipe).
  delete from public.lead_tasks
  where venue_id = v_venue
    and (
      title ilike 'QA Wiring%'
      or title ilike '%— snapshot verify'
      or title ilike '%— edited verify'
      or title ilike '%— lead complete sync'
    );

  -- 2) Resolve synthetic clients that still exist
  select coalesce(array_agg(c.id), '{}'::uuid[])
    into v_client_ids
  from public.clients c
  where c.venue_id = v_venue
    and c.id = any (v_synth_clients);

  if cardinality(v_client_ids) = 0 then
    raise notice 'No synthetic clients remaining; QA tasks cleaned.';
    -- Still repair Cindy sales_stage drift below.
  else
    select coalesce(array_agg(distinct c.relationship_id), '{}'::uuid[])
      into v_rel_ids
    from public.clients c
    where c.id = any (v_client_ids)
      and c.relationship_id is not null;

    -- Conversations for those relationships
    select coalesce(array_agg(c.id), '{}'::uuid[])
      into v_convo_ids
    from public.conversations c
    where c.venue_id = v_venue
      and c.relationship_id = any (v_rel_ids);

    if cardinality(v_convo_ids) > 0 then
      delete from public.conversation_messages
      where conversation_id = any (v_convo_ids);
      delete from public.conversations
      where id = any (v_convo_ids);
    end if;

    -- Events
    select coalesce(array_agg(e.id), '{}'::uuid[])
      into v_event_ids
    from public.events e
    where e.venue_id = v_venue
      and e.client_id = any (v_client_ids);

    if cardinality(v_event_ids) > 0 then
      -- Dependent planning rows that reference events (best-effort; ignore missing tables)
      begin
        delete from public.event_questionnaires where event_id = any (v_event_ids);
      exception when undefined_table then null;
      end;
      begin
        delete from public.event_orders where event_id = any (v_event_ids);
      exception when undefined_table then null;
      end;
      delete from public.events
      where id = any (v_event_ids)
        and venue_id = v_venue;
    end if;

    -- Payment schedules + line items
    select coalesce(array_agg(ps.id), '{}'::uuid[])
      into v_schedule_ids
    from public.payment_schedules ps
    where ps.venue_id = v_venue
      and ps.client_id = any (v_client_ids);

    if cardinality(v_schedule_ids) > 0 then
      delete from public.payment_line_items
      where schedule_id = any (v_schedule_ids);
      delete from public.payment_schedules
      where id = any (v_schedule_ids)
        and venue_id = v_venue;
    end if;

    -- Invoices + line items
    select coalesce(array_agg(i.id), '{}'::uuid[])
      into v_invoice_ids
    from public.invoices i
    where i.venue_id = v_venue
      and i.client_id = any (v_client_ids);

    if cardinality(v_invoice_ids) > 0 then
      begin
        delete from public.invoice_line_items
        where invoice_id = any (v_invoice_ids);
      exception when undefined_table then null;
      end;
      begin
        delete from public.invoice_payments
        where invoice_id = any (v_invoice_ids);
      exception when undefined_table then null;
      end;
      delete from public.invoices
      where id = any (v_invoice_ids)
        and venue_id = v_venue;
    end if;

    -- Contracts + signers
    select coalesce(array_agg(ct.id), '{}'::uuid[])
      into v_contract_ids
    from public.contracts ct
    where ct.venue_id = v_venue
      and ct.client_id = any (v_client_ids);

    if cardinality(v_contract_ids) > 0 then
      begin
        delete from public.contract_signers
        where contract_id = any (v_contract_ids);
      exception when undefined_table then null;
      end;
      begin
        delete from public.contract_activity
        where contract_id = any (v_contract_ids);
      exception when undefined_table then null;
      end;
      delete from public.contracts
      where id = any (v_contract_ids)
        and venue_id = v_venue;
    end if;

    -- Commercial selections (blocks client delete via check trigger when orphaned)
    begin
      delete from public.commercial_selections
      where venue_id = v_venue
        and client_id = any (v_client_ids);
    exception when undefined_table then null;
    end;

    -- Notes / documents / lifecycle tied to clients
    begin
      delete from public.client_notes
      where client_id = any (v_client_ids);
    exception when undefined_table then null;
    end;
    begin
      delete from public.documents
      where client_id = any (v_client_ids)
        and venue_id = v_venue;
    exception when undefined_table then
      null;
    when undefined_column then
      null;
    end;
    begin
      delete from public.lifecycle_booking_events
      where client_id = any (v_client_ids)
        and venue_id = v_venue;
    exception when undefined_table then null;
    end;

    -- Clients themselves (none of these have protected lead_id links)
    delete from public.clients
    where venue_id = v_venue
      and id = any (v_client_ids);

    -- Orphan fixture relationships (no remaining lead/client)
    if cardinality(v_rel_ids) > 0 then
      delete from public.venue_customer_relationships r
      where r.venue_id = v_venue
        and r.id = any (v_rel_ids)
        and not exists (select 1 from public.leads l where l.relationship_id = r.id)
        and not exists (select 1 from public.clients c where c.relationship_id = r.id);
    end if;
  end if;

  -- 3) Repair Cindy sales_stage drift vs Custom Proposal pipeline stage
  -- (pipeline_stage_id = Custom Proposal / proposal → sales_stage should be proposal_sent)
  update public.leads
  set
    sales_stage = 'proposal_sent',
    updated_at = now()
  where id = '12a8be4f-e555-4959-9760-f29a8c0c7df9'
    and venue_id = v_venue
    and pipeline_stage_id = '0a27ea42-768a-43a8-b1de-b5523702f825'
    and sales_stage is distinct from 'proposal_sent';

  raise notice 'Sandbox synthetic client/QA task cleanup complete.';
end $$;
