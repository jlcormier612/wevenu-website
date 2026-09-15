-- Human identity confirmation: matching signals are a review, not a merge.
-- Email may be shared by two deliberately distinct customers after the venue
-- chooses "Create new customer". Unattended reuse is email + same primary name only.

drop index if exists public.venue_customer_relationships_venue_email;

create index if not exists venue_customer_relationships_venue_email_lookup
  on public.venue_customer_relationships (venue_id, lower(email));

comment on index public.venue_customer_relationships_venue_email_lookup is
  'Lookup aid only — not unique. Distinct customers may share an email after an explicit venue identity decision.';

-- Safe returning-customer resolver. Never reuses on email-only, phone, or partner email.
create or replace function public.find_or_create_relationship(
  p_venue_id   uuid,
  p_email      text,
  p_first_name text,
  p_last_name  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_email text := nullif(trim(p_email), '');
  v_first text := nullif(trim(p_first_name), '');
  v_last  text := nullif(trim(p_last_name), '');
begin
  if v_email is not null and v_first is not null and v_last is not null then
    select id into v_id
    from public.venue_customer_relationships
    where venue_id = p_venue_id
      and lower(email) = lower(v_email)
      and lower(first_name) = lower(v_first)
      and lower(last_name) = lower(v_last)
    order by created_at asc
    limit 1;
  elsif v_email is null and v_first is not null and v_last is not null then
    select id into v_id
    from public.venue_customer_relationships
    where venue_id = p_venue_id and email is null
      and lower(first_name) = lower(v_first)
      and lower(last_name) = lower(v_last)
    order by created_at asc
    limit 1;
  end if;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
  values (p_venue_id, v_email, v_first, v_last)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.resolve_relationship_for_identity(
  p_venue_id uuid,
  p_email text,
  p_first_name text,
  p_last_name text,
  p_relationship_id uuid,
  p_create_new boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_create_new then
    insert into public.venue_customer_relationships (venue_id, email, first_name, last_name)
    values (p_venue_id, nullif(trim(p_email), ''), nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''))
    returning id into v_id;
    return v_id;
  end if;

  if p_relationship_id is not null then
    select id into v_id
    from public.venue_customer_relationships
    where id = p_relationship_id and venue_id = p_venue_id;
    if v_id is null then
      raise exception 'relationship not found for venue';
    end if;
    return v_id;
  end if;

  return public.find_or_create_relationship(p_venue_id, p_email, p_first_name, p_last_name);
end;
$$;

grant execute on function public.resolve_relationship_for_identity(uuid, text, text, text, uuid, boolean)
  to anon, authenticated, service_role;

create or replace function public.ingest_lead(
  p_venue_id uuid,
  p_source   text,
  p_input    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email           text := nullif(trim(p_input ->> 'email'), '');
  v_first           text := nullif(trim(p_input ->> 'firstName'), '');
  v_last            text := nullif(trim(p_input ->> 'lastName'), '');
  v_relationship_id uuid;
  v_explicit_rel    uuid := nullif(p_input ->> 'relationshipId', '')::uuid;
  v_force_new       boolean := coalesce((p_input ->> 'createNewRelationship')::boolean, false);
  v_was_existing    boolean := false;
  v_lead_id         uuid;
  v_is_historical   boolean := coalesce((p_input ->> 'isHistoricalImport')::boolean, false);
  v_prior           uuid;
begin
  if p_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_venue');
  end if;
  if v_first is null or v_last is null then
    return jsonb_build_object('ok', false, 'error', 'missing_name');
  end if;
  if p_source is not null and not exists (
    select 1 from public.lead_sources where key = p_source and is_enabled
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  if not v_force_new and v_explicit_rel is null then
    if v_email is not null then
      select id into v_prior
      from public.venue_customer_relationships
      where venue_id = p_venue_id
        and lower(email) = lower(v_email)
        and lower(first_name) = lower(v_first)
        and lower(last_name) = lower(v_last)
      order by created_at asc
      limit 1;
    else
      select id into v_prior
      from public.venue_customer_relationships
      where venue_id = p_venue_id and email is null
        and lower(first_name) = lower(v_first)
        and lower(last_name) = lower(v_last)
      order by created_at asc
      limit 1;
    end if;
    v_was_existing := v_prior is not null;
  elsif v_explicit_rel is not null then
    v_was_existing := true;
  end if;

  v_relationship_id := public.resolve_relationship_for_identity(
    p_venue_id, v_email, v_first, v_last, v_explicit_rel, v_force_new
  );

  insert into public.leads (
    venue_id, sales_stage, source, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count, estimated_budget,
    inquiry_message, inquiry_date, source_data, relationship_id, intake_confidence,
    is_historical_import
  ) values (
    p_venue_id, 'new_inquiry', p_source, v_first, v_last,
    v_email, nullif(trim(p_input ->> 'phone'), ''),
    nullif(trim(p_input ->> 'partnerFirstName'), ''),
    nullif(trim(p_input ->> 'partnerLastName'), ''),
    nullif(trim(p_input ->> 'partnerEmail'), ''),
    nullif(p_input ->> 'eventType', ''),
    nullif(p_input ->> 'eventDate', '')::date,
    nullif(p_input ->> 'endDate', '')::date,
    nullif(regexp_replace(coalesce(p_input ->> 'guestCount', ''), '[^0-9]', '', 'g'), '')::integer,
    nullif(regexp_replace(coalesce(p_input ->> 'estimatedBudget', ''), '[^0-9.]', '', 'g'), '')::numeric,
    nullif(trim(p_input ->> 'inquiryMessage'), ''),
    coalesce(nullif(p_input ->> 'inquiryDate', '')::date, current_date),
    coalesce(p_input -> 'sourceData', '{}'::jsonb),
    v_relationship_id,
    nullif(p_input ->> 'confidenceScore', '')::smallint,
    v_is_historical
  )
  returning id into v_lead_id;

  return jsonb_build_object(
    'ok', true,
    'leadId', v_lead_id,
    'relationshipId', v_relationship_id,
    'isReturningRelationship', v_was_existing
  );
end;
$$;

grant execute on function public.ingest_lead(uuid, text, jsonb) to anon, authenticated, service_role;

create or replace function public.create_client_atomic(payload jsonb, p_venue_id_override uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_venue_id     uuid;
  v_lead_id      uuid := nullif(payload ->> 'leadId', '')::uuid;
  v_email        text := nullif(trim(payload ->> 'email'), '');
  v_first        text := trim(payload ->> 'firstName');
  v_last         text := trim(payload ->> 'lastName');
  v_rel_id       uuid;
  v_client_id    uuid;
  v_is_historical boolean := coalesce((payload ->> 'isHistoricalImport')::boolean, false);
  v_explicit_rel uuid := nullif(payload ->> 'relationshipId', '')::uuid;
  v_force_new    boolean := coalesce((payload ->> 'createNewRelationship')::boolean, false);
begin
  v_venue_id := case
    when p_venue_id_override is not null and auth.role() = 'service_role' then p_venue_id_override
    else public.current_user_venue_id()
  end;

  if v_venue_id is null then
    raise exception 'not authorized for a venue';
  end if;
  if v_first = '' or v_last = '' then
    raise exception 'first and last name are required';
  end if;

  if v_lead_id is not null then
    select relationship_id into v_rel_id
    from public.leads
    where id = v_lead_id and venue_id = v_venue_id;
  end if;

  if v_rel_id is null then
    v_rel_id := public.resolve_relationship_for_identity(
      v_venue_id, v_email, v_first, v_last, v_explicit_rel, v_force_new
    );
  end if;

  insert into public.clients (
    venue_id, lead_id, first_name, last_name, email, phone,
    partner_first_name, partner_last_name, partner_email,
    event_type, event_date, end_date, guest_count,
    ceremony_time, reception_time, rehearsal_date, internal_notes,
    relationship_id, is_historical_import
  ) values (
    v_venue_id, v_lead_id,
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
    nullif(payload ->> 'ceremonyTime', '')::time,
    nullif(payload ->> 'receptionTime', '')::time,
    nullif(payload ->> 'rehearsalDate', '')::date,
    nullif(trim(payload ->> 'internalNotes'), ''),
    v_rel_id,
    v_is_historical
  )
  returning id into v_client_id;

  return v_client_id;
end;
$$;

grant execute on function public.create_client_atomic(jsonb, uuid) to authenticated, service_role;

-- Inbound SMS: refuse to pick when more than one relationship shares the number.
create or replace function public.find_relationship_by_phone_for_venue(
  p_phone text,
  p_venue_id uuid
)
returns table (
  venue_id uuid,
  relationship_id uuid,
  entity_type text,
  entity_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := public.normalize_phone_digits(p_phone);
  v_rel_count int;
  v_rel uuid;
begin
  if p_venue_id is null or v_digits = '' then
    return;
  end if;

  select count(distinct x.relationship_id), min(x.relationship_id)
  into v_rel_count, v_rel
  from (
    select l.relationship_id
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id is not null
      and public.normalize_phone_digits(l.phone) = v_digits
    union
    select c.relationship_id
    from public.clients c
    where c.venue_id = p_venue_id
      and c.relationship_id is not null
      and public.normalize_phone_digits(c.phone) = v_digits
  ) x;

  if v_rel_count is distinct from 1 then
    return;
  end if;

  return query
    select l.venue_id, l.relationship_id, 'lead'::text, l.id,
      trim(coalesce(l.first_name, '') || ' ' || coalesce(l.last_name, ''))
    from public.leads l
    where l.venue_id = p_venue_id
      and l.relationship_id = v_rel
      and public.normalize_phone_digits(l.phone) = v_digits
    order by l.created_at desc
    limit 1;

  if found then
    return;
  end if;

  return query
    select c.venue_id, c.relationship_id, 'client'::text, c.id,
      trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, ''))
    from public.clients c
    where c.venue_id = p_venue_id
      and c.relationship_id = v_rel
      and public.normalize_phone_digits(c.phone) = v_digits
    order by c.created_at desc
    limit 1;
end;
$$;

revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from public;
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from anon;
revoke all on function public.find_relationship_by_phone_for_venue(text, uuid) from authenticated;
grant execute on function public.find_relationship_by_phone_for_venue(text, uuid) to service_role;

notify pgrst, 'reload schema';
