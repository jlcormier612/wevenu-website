-- Purpose-specific public forms must enforce the same event-date availability
-- authority as create_public_lead when the venue uses choose_available.
-- Previously create_public_form_lead only checked required/optional visibility
-- and called ingest_lead with no _is_event_date_available gate.

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
  v_mode      text;
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

  select coalesce(v.inquiry_event_date_mode, 'request_preferred')
    into v_mode
  from public.venues v
  where v.id = v_form.venue_id;

  if v_mode = 'choose_available' and p_event_date is not null
     and not public._is_event_date_available(v_form.venue_id, p_event_date) then
    return jsonb_build_object('ok', false, 'error', 'date_unavailable');
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

comment on function public.create_public_form_lead(text, text, text, text, text, text, date, integer, text, jsonb) is
  'Public form intake via ingest_lead. When venue inquiry_event_date_mode is choose_available, preferred event dates are gated by _is_event_date_available (tour Blocked Dates, calendar_blocks, holds).';

grant execute on function public.create_public_form_lead(
  text, text, text, text, text, text, date, integer, text, jsonb
) to anon, authenticated;

notify pgrst, 'reload schema';
