-- ============================================================================
-- Fix: a Lead that fails to insert can leave behind an orphaned Relationship
-- ============================================================================
-- Bug reported directly: leads entered/uploaded "didn't save." Confirmed in
-- the data: `venue_customer_relationships` had rows with no matching `leads`
-- row at all. Root cause is structural, not a bad value in any one field —
-- `lib/leads/repository.ts`'s `insertLead` made two separate network calls
-- from the application: first `find_or_create_relationship` (which commits
-- immediately, since it's its own statement), then a second `insert into
-- leads`. If anything makes the second call fail — a malformed date, a lost
-- connection, any real-world reason — the Relationship from the first call
-- has already committed and stays committed. The coordinator sees nothing:
-- no lead in their pipeline, and (until now) no record of a relationship
-- existing either, since nothing surfaced it as an error worth noticing.
--
-- Fix: both operations now happen inside one function, so they succeed or
-- fail together — a coordinator can never end up with a customer identity
-- and no visible Lead to show for it.
--
-- Second, smaller, independently real bug fixed in the same pass:
-- `find_or_create_relationship` only ever deduped by email — when email is
-- blank (common for a lead taken over the phone before an email is
-- collected), every submission created a brand new Relationship even for
-- the exact same name. Confirmed directly: two "Ron Cormier" relationships,
-- both with a null email, from what was almost certainly the same person
-- submitted twice. Added an exact-name fallback match for the blank-email
-- case only — email remains the sole dedup key whenever it's present,
-- unchanged from before.
-- ============================================================================

create or replace function public.create_lead_atomic(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id  uuid := public.current_user_venue_id();
  v_email     text := nullif(trim(payload ->> 'email'), '');
  v_first     text := trim(payload ->> 'firstName');
  v_last      text := trim(payload ->> 'lastName');
  v_rel_id    uuid;
  v_lead_id   uuid;
begin
  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'first and last name are required';
  end if;

  if v_email is not null then
    select id into v_rel_id
    from public.venue_customer_relationships
    where venue_id = v_venue_id and lower(email) = lower(v_email)
    limit 1;
  else
    -- No email given: fall back to an exact name match against other
    -- blank-email relationships only, so a re-submitted phone inquiry
    -- doesn't fork into a second customer identity. Never applied when an
    -- email is present — email stays the one real identity key.
    select id into v_rel_id
    from public.venue_customer_relationships
    where venue_id = v_venue_id and email is null
      and lower(first_name) = lower(v_first)
      and lower(last_name)  = lower(v_last)
    limit 1;
  end if;

  if v_rel_id is null then
    insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
    values (v_venue_id, v_email, v_first, v_last)
    returning id into v_rel_id;
  end if;

  insert into public.leads (
    venue_id, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count, estimated_budget,
    source, inquiry_message, inquiry_date, status, relationship_id
  ) values (
    v_venue_id,
    v_first, v_last,
    v_email,
    nullif(trim(payload ->> 'phone'), ''),
    nullif(trim(payload ->> 'partnerFirstName'), ''),
    nullif(trim(payload ->> 'partnerLastName'), ''),
    nullif(trim(payload ->> 'partnerEmail'), ''),
    nullif(payload ->> 'eventType', ''),
    nullif(payload ->> 'eventDate', '')::date,
    nullif(payload ->> 'endDate', '')::date,
    nullif(regexp_replace(coalesce(payload ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    nullif(regexp_replace(coalesce(payload ->> 'estimatedBudget', ''), '[^0-9.]', '', 'g'), '')::numeric,
    nullif(payload ->> 'source', ''),
    nullif(trim(payload ->> 'inquiryMessage'), ''),
    coalesce(nullif(payload ->> 'inquiryDate', '')::date, current_date),
    'new',
    v_rel_id
  )
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

grant execute on function public.create_lead_atomic(jsonb) to authenticated;

notify pgrst, 'reload schema';
