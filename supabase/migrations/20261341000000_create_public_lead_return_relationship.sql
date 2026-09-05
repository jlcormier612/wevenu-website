-- create_public_lead already calls ingest_lead, which returns relationshipId
-- and isReturningRelationship. The public inquiry route needs those fields to
-- complete intake without a post-create SELECT on public.leads (anon RLS hides
-- the row, falsely yielding "Lead created without a relationship.").

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

notify pgrst, 'reload schema';
