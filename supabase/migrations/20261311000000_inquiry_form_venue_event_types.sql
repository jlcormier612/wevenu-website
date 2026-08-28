-- ============================================================================
-- Venue-configurable event types for the public Inquiry Form / Schedule Tour
-- flow. The Event Type dropdown previously always rendered the full
-- platform-canonical PUBLIC_INQUIRY_EVENT_TYPES list (lib/inquiry-form/
-- constants.ts) regardless of venue — this adds a per-venue subset selector
-- over that same canonical vocabulary, mirroring the existing
-- venues.stripe_accepted_payment_methods pattern (canonical list + venue
-- subset + non-empty default, not a free-text field).
--
-- Default is the full canonical set (all 5 values) so no existing venue's
-- public form silently narrows the moment this ships — venues opt into a
-- narrower list from Settings, they are never defaulted into one.
-- ============================================================================

alter table public.venues
  add column if not exists accepted_inquiry_event_types text[]
  not null default array['wedding','corporate_event','social_event','birthday_milestone','other'];

alter table public.venues
  drop constraint if exists venues_accepted_inquiry_event_types_check;

alter table public.venues
  add constraint venues_accepted_inquiry_event_types_check
  check (
    accepted_inquiry_event_types <@ array['wedding','corporate_event','social_event','birthday_milestone','other']::text[]
    and array_length(accepted_inquiry_event_types, 1) > 0
  );

comment on column public.venues.accepted_inquiry_event_types is
  'Subset of the canonical public-inquiry event-type vocabulary (lib/inquiry-form/constants.ts PUBLIC_INQUIRY_EVENT_TYPES) this venue accepts on its public Inquiry/Schedule Tour form. Never empty; defaults to all values.';

-- ---- Expose on the public form config RPC -----------------------------------

create or replace function public.get_public_inquiry_form(p_embed_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue public.venues%rowtype;
  v_questions jsonb;
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
    'customQuestions', v_questions
  );
end;
$$;

grant execute on function public.get_public_inquiry_form(text) to anon, authenticated;

notify pgrst, 'reload schema';
