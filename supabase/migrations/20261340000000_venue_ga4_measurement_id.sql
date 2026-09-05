-- Phase 2C — per-venue GA4 Measurement ID boundary (nullable = no-op).
-- No admin UI in this phase; set via SQL / future settings.
-- Does NOT introduce a global HTC Measurement ID for venue forms.

alter table public.venues
  add column if not exists ga4_measurement_id text;

comment on column public.venues.ga4_measurement_id is
  'Optional GA4 Measurement ID (G-XXXXXXXX) for this venue''s public inquiry/tour forms. Null/empty = analytics no-op. Never use an HTC marketing property ID here.';

-- Soft format check: null/blank allowed; non-blank must look like G-…
alter table public.venues
  drop constraint if exists venues_ga4_measurement_id_format;
alter table public.venues
  add constraint venues_ga4_measurement_id_format
  check (
    ga4_measurement_id is null
    or btrim(ga4_measurement_id) = ''
    or ga4_measurement_id ~* '^G-[A-Z0-9]+$'
  );

-- Expose on public form config RPC (anon-readable for the embed experience).
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
    'ga4MeasurementId', v_ga4
  );
end;
$$;

grant execute on function public.get_public_inquiry_form(text) to anon, authenticated;

notify pgrst, 'reload schema';
