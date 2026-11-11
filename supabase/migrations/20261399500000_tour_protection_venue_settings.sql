-- ============================================================================
-- Tour Protection — venue settings (additive).
--
-- A venue may require payment protection before a public tour appointment is
-- created. Staff-created tours are unaffected (book_tour_for_lead).
--
-- Eligibility is NOT a new flag. A venue can actually collect protection only
-- when stripe_account_id is present AND stripe_charges_enabled is true.
-- ============================================================================

alter table public.venues
  add column if not exists tour_protection_mode text not null default 'none'
    check (tour_protection_mode in ('none', 'setup', 'fee')),
  add column if not exists tour_protection_fee_cents integer not null default 0
    check (tour_protection_fee_cents >= 0);

comment on column public.venues.tour_protection_mode is
  'Public tour protection: none = book normally; setup = card on file (no charge); fee = charge a tour fee on the connected account before the appointment is created.';

comment on column public.venues.tour_protection_fee_cents is
  'Tour fee in cents when tour_protection_mode = fee. Not an event invoice. Charged on the venue Stripe Connect account.';

-- Public inquiry form: disclose protection without exposing Stripe internals.
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
  v_protection_required boolean;
  v_protection_kind text;
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

  v_protection_required :=
    v_venue.tour_scheduling_enabled
    and v_venue.tour_protection_mode in ('setup', 'fee')
    and v_venue.stripe_account_id is not null
    and coalesce(v_venue.stripe_charges_enabled, false) = true
    and (
      v_venue.tour_protection_mode = 'setup'
      or (v_venue.tour_protection_mode = 'fee' and v_venue.tour_protection_fee_cents > 0)
    );
  v_protection_kind := case when v_protection_required then v_venue.tour_protection_mode else null end;

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
    'inquiryCommunicationSettings', v_comm,
    'tourProtectionRequired', v_protection_required,
    'tourProtectionKind', v_protection_kind,
    'tourProtectionFeeCents', case
      when v_protection_required and v_venue.tour_protection_mode = 'fee'
        then v_venue.tour_protection_fee_cents
      else null
    end
  );
end;
$$;

grant execute on function public.get_public_inquiry_form(text) to anon, authenticated;

notify pgrst, 'reload schema';
