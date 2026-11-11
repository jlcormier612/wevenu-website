-- Sandbox: remove synthetic/E2E tour-protection fixtures contaminating
-- operational surfaces (Tours, Luv, Today's Focus, Calendar).
-- Idempotent. No-ops when rows are absent. Does not touch production
-- venues other than Jen's Fancy Sandbox.

do $$
declare
  v_venue uuid := 'a415ac52-cd74-42a6-8df7-7a8f6e71d080';
  v_tour_ids uuid[] := array[
    'f8477dfb-3374-4327-b13d-8993ed5d0671'::uuid, -- E2EProtOff JenFancy / e2e-protoff@example.com
    'dc177996-86b7-4f37-8b97-323e03eadf00'::uuid, -- EProtectOff E2E / eprotect.off@example.test
    '85b60faa-3255-4428-9671-5f4ae21ec23d'::uuid, -- EProtectStaff E2E / eprotect.staff@example.test
    '319dece4-0f73-4333-a055-143a390961aa'::uuid  -- orphan "Unknown" tour (no contact, no lead)
  ];
  v_rel_ids uuid[] := array[
    '6bf4ef6c-ff8e-4016-a0a5-8a7450f2fd86'::uuid, -- E2EProtOff JenFancy
    '83c06630-81c2-467b-8cc2-5a42e8064c91'::uuid, -- EProtectOff E2E
    '0e3b606e-fbdb-48b4-ab8d-e4b93f496d1b'::uuid  -- EProtectStaff E2E
  ];
  v_convo_ids uuid[];
  v_lydia_tour uuid := 'edb44f04-958d-4969-aa81-dbd36d5a8edf';
  v_lydia_lead uuid := '82d09351-b336-4ff0-905a-9b59e8d4e07d';
begin
  if not exists (select 1 from public.venues where id = v_venue) then
    raise notice 'Sandbox venue absent — nothing to clean.';
    return;
  end if;

  -- Collect conversations for the synthetic relationships.
  select coalesce(array_agg(c.id), '{}'::uuid[])
    into v_convo_ids
  from public.conversations c
  where c.venue_id = v_venue
    and c.relationship_id = any (v_rel_ids);

  -- Messages → conversations → tours → relationships (fixture-only).
  if cardinality(v_convo_ids) > 0 then
    delete from public.conversation_messages
    where conversation_id = any (v_convo_ids);

    delete from public.conversations
    where id = any (v_convo_ids);
  end if;

  delete from public.tour_appointments
  where venue_id = v_venue
    and id = any (v_tour_ids);

  -- Also catch any remaining appointments whose contact identity is clearly
  -- the same E2E tour-protection fixtures (email domains / names).
  delete from public.tour_appointments
  where venue_id = v_venue
    and (
      lower(coalesce(contact_email, '')) like '%@example.com'
      or lower(coalesce(contact_email, '')) like '%@example.test'
      or lower(coalesce(contact_name, '')) like '%e2e%'
      or lower(coalesce(contact_name, '')) like '%eprotect%'
      or lower(coalesce(contact_name, '')) like '%jenfancy%'
    );

  -- Only delete relationships that have no remaining lead/client (fixture-only).
  delete from public.venue_customer_relationships r
  where r.venue_id = v_venue
    and r.id = any (v_rel_ids)
    and not exists (select 1 from public.leads l where l.relationship_id = r.id)
    and not exists (select 1 from public.clients c where c.relationship_id = r.id);

  -- Legitimate Lydia Cormier tour had blank contact fields → showed as Unknown.
  -- Backfill display identity from the linked lead (do not delete the tour).
  update public.tour_appointments ta
  set
    contact_name = trim(both from concat_ws(' ', l.first_name, l.last_name)),
    contact_email = coalesce(nullif(ta.contact_email, ''), l.email),
    contact_phone = coalesce(nullif(ta.contact_phone, ''), l.phone)
  from public.leads l
  where ta.id = v_lydia_tour
    and ta.venue_id = v_venue
    and l.id = v_lydia_lead
    and l.venue_id = v_venue
    and (ta.contact_name is null or trim(ta.contact_name) = '');

  raise notice 'Removed Sandbox synthetic tour fixtures and repaired Lydia tour contact.';
end $$;
