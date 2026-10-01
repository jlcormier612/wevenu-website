-- Durable authorship for leads.inquiry_message.
-- Existing rows stay unknown — never guessed as customer-authored.

alter table public.leads
  add column if not exists inquiry_message_origin text not null default 'unknown';

alter table public.leads
  drop constraint if exists leads_inquiry_message_origin_check;

alter table public.leads
  add constraint leads_inquiry_message_origin_check
  check (inquiry_message_origin in ('customer', 'venue', 'unknown'));

comment on column public.leads.inquiry_message_origin is
  'Authorship of inquiry_message: customer | venue | unknown. Legacy/import stay unknown.';

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
  v_origin          text := lower(nullif(trim(p_input ->> 'inquiryMessageOrigin'), ''));
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

  if v_origin is null or v_origin not in ('customer', 'venue', 'unknown') then
    v_origin := 'unknown';
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
    inquiry_message, inquiry_message_origin, inquiry_date, source_data,
    relationship_id, intake_confidence, is_historical_import
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
    v_origin,
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

create or replace function public.create_public_lead(
  p_embed_key        text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_partner_first    text,
  p_partner_last     text,
  p_partner_email    text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_estimated_budget numeric,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_mode     text;
  v_fields   jsonb;
  v_accepted text[];
  v_type     text;
  v_result   jsonb;
  v_merged   jsonb;
begin
  select id, inquiry_event_date_mode, inquiry_form_fields, accepted_inquiry_event_types
  into v_venue_id, v_mode, v_fields, v_accepted
  from public.venues
  where embed_key = p_embed_key;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Invalid form key.');
  end if;

  v_type := public.normalize_event_type(p_event_type);
  if v_type is null then
    return jsonb_build_object('ok', false, 'error', 'event_type_required');
  end if;

  if v_accepted is null or array_length(v_accepted, 1) is null then
    v_accepted := array['wedding','corporate','social_event','birthday','other']::text[];
  end if;

  if not (v_type = any (v_accepted)) then
    return jsonb_build_object('ok', false, 'error', 'event_type_not_accepted');
  end if;

  if coalesce(v_fields->>'phone', 'optional') = 'required' and nullif(trim(p_phone), '') is null then
    return jsonb_build_object('ok', false, 'error', 'phone_required');
  end if;
  if coalesce(v_fields->>'partner', 'optional') = 'required'
     and (nullif(trim(p_partner_first), '') is null or nullif(trim(p_partner_last), '') is null) then
    return jsonb_build_object('ok', false, 'error', 'partner_required');
  end if;
  if coalesce(v_fields->>'preferred_event_date', 'optional') = 'required' and p_event_date is null then
    return jsonb_build_object('ok', false, 'error', 'event_date_required');
  end if;
  if coalesce(v_fields->>'guest_count', 'optional') = 'required' and p_guest_count is null then
    return jsonb_build_object('ok', false, 'error', 'guest_count_required');
  end if;
  if coalesce(v_fields->>'estimated_budget', 'optional') = 'required'
     and (p_estimated_budget is null or p_estimated_budget <= 0) then
    return jsonb_build_object('ok', false, 'error', 'budget_required');
  end if;
  if coalesce(v_fields->>'event_details', 'optional') = 'required' and nullif(trim(p_message), '') is null then
    return jsonb_build_object('ok', false, 'error', 'event_details_required');
  end if;

  if v_mode = 'choose_available' and p_event_date is not null
     and not public._is_event_date_available(v_venue_id, p_event_date) then
    return jsonb_build_object('ok', false, 'error', 'date_unavailable');
  end if;

  v_merged := coalesce(p_source_data, '{}'::jsonb)
    || jsonb_build_object(
      'submitted_at', now(),
      'inquiry_mode', coalesce(p_source_data ->> 'inquiry_mode', 'request_information')
    );

  v_result := public.ingest_lead(
    v_venue_id,
    'website',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'email', p_email, 'phone', p_phone,
      'partnerFirstName', p_partner_first, 'partnerLastName', p_partner_last, 'partnerEmail', p_partner_email,
      'eventType', v_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'estimatedBudget', case when p_estimated_budget > 0 then p_estimated_budget else null end,
      'inquiryMessage', p_message,
      'inquiryMessageOrigin', 'customer',
      'sourceData', v_merged
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_result ->> 'leadId',
    'relationshipId', v_result ->> 'relationshipId',
    'isReturningRelationship', coalesce((v_result ->> 'isReturningRelationship')::boolean, false)
  );
end;
$$;

grant execute on function public.create_public_lead(text, text, text, text, text, text, text, text, text, date, integer, numeric, text, jsonb) to anon, authenticated;

create or replace function public.create_public_form_lead(
  p_public_key       text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_event_type       text,
  p_event_date       date,
  p_guest_count      integer,
  p_message          text,
  p_source_data      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form     public.public_forms%rowtype;
  v_fields   jsonb;
  v_type     text;
  v_result   jsonb;
  v_merged   jsonb;
  v_phone_vis text;
  v_type_vis  text;
  v_date_vis  text;
  v_guest_vis text;
begin
  select * into v_form
  from public.public_forms
  where public_key = p_public_key
    and status = 'published';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Form is not available.');
  end if;

  v_fields := coalesce(v_form.field_config, '{}'::jsonb);
  v_phone_vis := coalesce(v_fields->>'phone', 'optional');
  v_type_vis := coalesce(v_fields->>'event_type', 'hidden');
  v_date_vis := coalesce(v_fields->>'preferred_event_date', 'optional');
  v_guest_vis := coalesce(v_fields->>'guest_count', 'optional');

  if nullif(trim(p_first_name), '') is null or nullif(trim(p_last_name), '') is null then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;
  if nullif(trim(p_email), '') is null then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;

  if v_phone_vis = 'required' and nullif(trim(p_phone), '') is null then
    return jsonb_build_object('ok', false, 'error', 'phone_required');
  end if;
  if v_date_vis = 'required' and p_event_date is null then
    return jsonb_build_object('ok', false, 'error', 'event_date_required');
  end if;
  if v_guest_vis = 'required' and p_guest_count is null then
    return jsonb_build_object('ok', false, 'error', 'guest_count_required');
  end if;

  if v_type_vis = 'hidden' then
    v_type := 'other';
  else
    v_type := public.normalize_event_type(p_event_type);
    if v_type is null then
      if v_type_vis = 'required' then
        return jsonb_build_object('ok', false, 'error', 'event_type_required');
      end if;
      v_type := 'other';
    end if;
  end if;

  v_merged := coalesce(p_source_data, '{}'::jsonb)
    || jsonb_build_object(
      'submitted_at', now(),
      'source', 'public_form',
      'public_form_id', v_form.id::text,
      'public_form_internal_name', v_form.internal_name,
      'public_form_public_title', v_form.public_title,
      'form_key', v_form.public_key
    );

  v_result := public.ingest_lead(
    v_form.venue_id,
    'website',
    jsonb_build_object(
      'firstName', p_first_name, 'lastName', p_last_name,
      'email', p_email, 'phone', p_phone,
      'partnerFirstName', null, 'partnerLastName', null, 'partnerEmail', null,
      'eventType', v_type, 'eventDate', p_event_date,
      'guestCount', p_guest_count,
      'estimatedBudget', null,
      'inquiryMessage', p_message,
      'inquiryMessageOrigin', 'customer',
      'sourceData', v_merged
    )
  );

  if not (v_result ->> 'ok')::boolean then
    return v_result;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_result ->> 'leadId',
    'relationshipId', v_result ->> 'relationshipId',
    'isReturningRelationship', coalesce((v_result ->> 'isReturningRelationship')::boolean, false)
  );
end;
$$;

grant execute on function public.create_public_form_lead(
  text, text, text, text, text, text, date, integer, text, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
