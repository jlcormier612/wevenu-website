-- First-party communication preferences (lead form) + SMS permission evidence wiring.
-- Prefs are independent of phone and of communication_permissions (SMS send rules).

alter table public.venues
  add column if not exists inquiry_communication_settings jsonb not null
  default jsonb_build_object(
    'askPreferences', false,
    'offerEmail', true,
    'offerSms', true,
    'offerPhoneCall', true,
    'requestSmsPermission', true
  );

comment on column public.venues.inquiry_communication_settings is
  'Venue lead-form communication preference + SMS permission request config. SMS options must still be gated by texting readiness in application code.';

alter table public.leads
  add column if not exists preferred_communication_channels text[] not null default '{}';

comment on column public.leads.preferred_communication_channels is
  'Preferred contact channels chosen on the inquiry form: email, sms, and/or phone_call. Not SMS permission.';

alter table public.clients
  add column if not exists preferred_communication_channels text[] not null default '{}';

comment on column public.clients.preferred_communication_channels is
  'Preferred contact channels (email, sms, phone_call). Not SMS permission.';

-- Expose settings on the public inquiry form RPC (anon-readable for embed).
create or replace function public.get_public_inquiry_form(p_embed_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues%rowtype;
  v_questions jsonb;
  v_ga4 text;
  v_comm jsonb;
begin
  select * into v_venue from public.venues where embed_key = p_embed_key;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'questionText', q.question_text,
      'questionType', q.question_type,
      'required', q.required,
      'options', coalesce(q.options, '[]'::jsonb),
      'sortOrder', q.sort_order
    ) order by q.sort_order, q.created_at
  ), '[]'::jsonb)
  into v_questions
  from public.inquiry_form_questions q
  where q.venue_id = v_venue.id;

  v_ga4 := nullif(btrim(coalesce(v_venue.ga4_measurement_id, '')), '');
  v_comm := coalesce(
    v_venue.inquiry_communication_settings,
    jsonb_build_object(
      'askPreferences', false,
      'offerEmail', true,
      'offerSms', true,
      'offerPhoneCall', true,
      'requestSmsPermission', true
    )
  );

  return jsonb_build_object(
    'ok', true,
    'venue', jsonb_build_object(
      'id', v_venue.id,
      'name', v_venue.name,
      'logoUrl', v_venue.logo_url,
      'primaryColor', coalesce(v_venue.primary_color, '#5D6F5D'),
      'secondaryColor', coalesce(v_venue.secondary_color, '#4F5F4F'),
      'email', v_venue.email,
      'phone', v_venue.phone,
      'addressLine1', v_venue.address_line1,
      'city', v_venue.city,
      'stateRegion', v_venue.state_region
    ),
    'tourSchedulingEnabled', coalesce(v_venue.tour_scheduling_enabled, false),
    'tourEmbedKey', v_venue.tour_embed_key,
    'inquiryEventDateMode', v_venue.inquiry_event_date_mode,
    'inquiryFormFields', v_venue.inquiry_form_fields,
    'acceptedEventTypes', to_jsonb(v_venue.accepted_inquiry_event_types),
    'customQuestions', v_questions,
    'ga4MeasurementId', v_ga4,
    'inquiryCommunicationSettings', v_comm
  );
end;
$$;

grant execute on function public.get_public_inquiry_form(text) to anon, authenticated;

notify pgrst, 'reload schema';
