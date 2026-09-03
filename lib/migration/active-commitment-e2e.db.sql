-- ============================================================================
-- Smith Wedding — active financial cutover acceptance (DB + portal)
-- Run inside begin…rollback by the test harness.
--
-- Proves canonical HTC objects (not a parallel ledger) support:
--   Event Order + Invoice + Payment Schedule + historical paid
--   Externally executed contract + Event document
--   Couple portal payments + documents after explicit share
--   Idempotent external-contract uniqueness
-- ============================================================================

do $$
declare
  v_venue uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee90';
  v_owner uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeee91';
  v_client uuid;
  v_event uuid;
  v_order uuid;
  v_invoice uuid;
  v_schedule uuid;
  v_contract uuid;
  v_document uuid;
  v_line_paid uuid;
  v_line_rem1 uuid;
  v_line_rem2 uuid;
  v_balance numeric;
  v_total numeric;
  v_portal jsonb;
  v_docs jsonb;
  v_token text := 'smith-wedding-portal-token-e2e-0001';
  v_dup int;
begin
  delete from public.venues where id = v_venue;
  delete from auth.users where id = v_owner;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
    'smith-cutover-owner@example.test', crypt('not-a-login', gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.venues (id, owner_user_id, name, timezone)
  values (v_venue, v_owner, 'Smith Cutover Venue', 'America/New_York');

  insert into public.clients (
    id, venue_id, first_name, last_name, email, status
  ) values (
    gen_random_uuid(), v_venue, 'Alex', 'Smith', 'smith@example.com', 'confirmed'
  ) returning id into v_client;

  insert into public.events (
    id, venue_id, client_id, name, event_date, guest_count, status
  ) values (
    gen_random_uuid(), v_venue, v_client, 'Smith Wedding', '2026-10-17', 150, 'confirmed'
  ) returning id into v_event;

  -- Canonical Event Order (same tables native booking uses)
  insert into public.event_orders (id, venue_id, event_id, status, revision)
  values (gen_random_uuid(), v_venue, v_event, 'open', 1)
  returning id into v_order;

  insert into public.event_order_lines (
    venue_id, event_order_id, provenance, description, quantity, unit_price, amount, sort_order
  ) values (
    v_venue, v_order, 'custom', 'Full Service Wedding', 1, 18500, 18500, 0
  );

  insert into public.invoices (
    id, venue_id, client_id, event_id, event_order_id, invoice_number, status,
    subtotal, total, balance_due, issued_at, is_couple_visible, notes
  ) values (
    gen_random_uuid(), v_venue, v_client, v_event, v_order, 'MIG-SMITH-1', 'sent',
    18500, 18500, 18500, now(), false,
    'Migrated active booking — totals and payments recorded from the prior system after human review.'
  ) returning id into v_invoice;

  insert into public.invoice_line_items (
    venue_id, invoice_id, type, description, quantity, unit_price, amount, sort_order
  ) values (
    v_venue, v_invoice, 'item', 'Full Service Wedding', 1, 18500, 18500, 0
  );

  insert into public.payment_schedules (
    id, venue_id, client_id, event_id, invoice_id, title, total_amount, notes
  ) values (
    gen_random_uuid(), v_venue, v_client, v_event, v_invoice, 'Payment plan', 18500,
    'Migrated payment plan — historical paid lines were not processed by Hello to Cheers.'
  ) returning id into v_schedule;

  insert into public.payment_line_items (
    id, venue_id, schedule_id, label, amount, due_date, status, obligation_kind,
    paid_at, paid_amount, payment_method, notes, sort_order
  ) values (
    gen_random_uuid(), v_venue, v_schedule, 'Deposit', 5000, '2026-06-01', 'paid', 'deposit',
    '2026-06-01T12:00:00Z', 5000, 'other',
    'Migrated payment — collected outside Hello to Cheers; not processed by HTC.', 0
  ) returning id into v_line_paid;

  insert into public.payment_line_items (
    id, venue_id, schedule_id, label, amount, due_date, status, obligation_kind, sort_order
  ) values (
    gen_random_uuid(), v_venue, v_schedule, 'Second payment', 5000, '2026-09-15', 'pending', 'installment', 1
  ) returning id into v_line_rem1;

  insert into public.payment_line_items (
    id, venue_id, schedule_id, label, amount, due_date, status, obligation_kind, sort_order
  ) values (
    gen_random_uuid(), v_venue, v_schedule, 'Final payment', 8500, '2026-10-01', 'pending', 'final', 2
  ) returning id into v_line_rem2;

  -- Reconcile remaining balance the same way payments do
  update public.invoices
  set balance_due = greatest(0, total - 5000)
  where id = v_invoice;

  select total, balance_due into v_total, v_balance from public.invoices where id = v_invoice;
  if v_total <> 18500 or v_balance <> 13500 then
    raise exception 'SMITH_FAIL balance expected total=18500 remaining=13500 got total=% remaining=%', v_total, v_balance;
  end if;

  -- Externally executed agreement (no e-sign rows)
  insert into public.contracts (
    id, venue_id, client_id, event_id, title, content, status, execution_origin,
    signer_name, signed_at, is_couple_visible
  ) values (
    gen_random_uuid(), v_venue, v_client, v_event,
    'Smith Wedding Agreement',
    'Externally executed agreement. Contracted total: $18,500. Not signed inside Hello to Cheers.',
    'signed', 'external', 'Alex Smith', '2026-05-20T12:00:00Z', false
  ) returning id into v_contract;

  if exists (
    select 1 from public.contract_signers where contract_id = v_contract
  ) then
    raise exception 'SMITH_FAIL external contract must not fabricate contract_signers';
  end if;

  -- Duplicate external contract blocked by unique index
  begin
    insert into public.contracts (
      venue_id, client_id, event_id, title, content, status, execution_origin, signed_at, is_couple_visible
    ) values (
      v_venue, v_client, v_event, 'Dup', 'Dup', 'signed', 'external', now(), false
    );
    raise exception 'SMITH_FAIL expected unique external contract per event';
  exception
    when unique_violation then
      null; -- expected
  end;

  insert into public.documents (
    id, venue_id, event_id, name, file_name, storage_path, storage_url,
    mime_type, category, notes, is_couple_visible, tags
  ) values (
    gen_random_uuid(), v_venue, v_event,
    'Smith Wedding Agreement', 'smith-signed.pdf',
    v_venue::text || '/migration/active-commitment/smith-signed.pdf',
    'https://example.test/smith-signed.pdf',
    'application/pdf', 'contract',
    'Original signed agreement from the prior system (linked to externally executed HTC contract).',
    false, array['migration','active-commitment']
  ) returning id into v_document;

  -- Portal session for the couple
  insert into public.client_portal_sessions (
    venue_id, client_id, access_token, access_level, expires_at
  ) values (
    v_venue, v_client, v_token, 'couple', now() + interval '30 days'
  );

  -- Before share: private (invoice is sent for venue ops, but not couple-visible yet)
  v_portal := public.get_portal_payments(v_token);
  if jsonb_array_length(coalesce(v_portal->'schedules', '[]'::jsonb)) <> 0 then
    raise exception 'SMITH_FAIL portal must hide payment schedule until invoice is couple-visible: %', v_portal;
  end if;

  v_docs := public.get_couple_documents(v_token);
  if v_docs::text ilike '%' || v_contract::text || '%' then
    raise exception 'SMITH_FAIL unshared contract must not appear in couple documents: %', v_docs;
  end if;

  -- Explicit share (same flags native HTC uses)
  update public.contracts set is_couple_visible = true where id = v_contract;
  update public.documents set is_couple_visible = true where id = v_document;
  update public.invoices set is_couple_visible = true where id = v_invoice;

  v_portal := public.get_portal_payments(v_token);
  if jsonb_array_length(coalesce(v_portal->'schedules', '[]'::jsonb)) < 1 then
    raise exception 'SMITH_FAIL portal should show payment schedule after share: %', v_portal;
  end if;
  if (v_portal->'schedules'->0->>'totalAmount')::numeric <> 18500 then
    raise exception 'SMITH_FAIL portal schedule total: %', v_portal;
  end if;

  v_docs := public.get_couple_documents(v_token);
  if v_docs::text not like '%' || 'Smith Wedding Agreement' || '%'
     and v_docs::text not like '%' || v_contract::text || '%'
  then
    raise exception 'SMITH_FAIL after share couple documents should include agreement: %', v_docs;
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_docs->'documents', '[]'::jsonb)) d
    where d->>'id' = v_contract::text
      and nullif(d->>'fileUrl', '') is not null
  ) then
    raise exception 'SMITH_FAIL after share contract card must expose retained fileUrl: %', v_docs;
  end if;

  -- Venue can operate: Event still normal confirmed future Event
  if not exists (
    select 1 from public.events
    where id = v_event and client_id = v_client and event_date = '2026-10-17' and status = 'confirmed'
  ) then
    raise exception 'SMITH_FAIL event not operable as native future Event';
  end if;

  -- No second-class client marker required — client is a normal active client
  if not exists (
    select 1 from public.clients where id = v_client and email = 'smith@example.com' and status = 'confirmed'
  ) then
    raise exception 'SMITH_FAIL client not a normal HTC client';
  end if;

  raise notice 'SMITH_OK %', jsonb_build_object(
    'eventId', v_event,
    'clientId', v_client,
    'eventOrderId', v_order,
    'invoiceId', v_invoice,
    'scheduleId', v_schedule,
    'contractId', v_contract,
    'documentId', v_document,
    'balanceDue', v_balance,
    'portalSchedules', jsonb_array_length(v_portal->'schedules'),
    'externalContract', true,
    'noFabricatedSigners', true
  );
end;
$$;
