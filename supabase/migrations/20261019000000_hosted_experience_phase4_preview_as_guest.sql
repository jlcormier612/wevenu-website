-- ============================================================================
-- Hosted Experience Platform — Phase 4: "Preview as this guest"
--
-- docs/hosted-experience-platform-architecture-spec.md §4/§12 Phase 4 —
-- the highest-leverage recommendation from the original competitive
-- research (Riley & Grey's "preview as a specific guest" mode was the one
-- capability no freeform website builder can copy, because none of them
-- own a guest record the way this platform does).
--
-- Mirrors get_rsvp_context's query shape closely (same output shape, so
-- the same RsvpPage component renders both), but authenticates via the
-- couple's own portal session instead of a guest's rsvp_token, and scopes
-- the guest lookup to that session's own client_id — a coordinator/couple
-- can only ever preview their own guests, never enumerate another
-- client's guest by id. Deliberately does not return the guest's real
-- rsvp_token — the Studio passes an empty token to RsvpPage's readOnly
-- mode, so even if the disabled submit button were somehow bypassed,
-- there is no real token in the response to submit against.
-- ============================================================================

create or replace function public.preview_rsvp_as_guest(p_token text, p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_guest        public.couple_guests%rowtype;
  v_client       public.clients%rowtype;
  v_event        public.events%rowtype;
  v_venue        public.venues%rowtype;
  v_website_slug text;
  v_accent_color text;
begin
  select * into v_session from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_guest
  from public.couple_guests
  where id = p_guest_id and client_id = v_session.client_id and venue_id = v_session.venue_id;

  if not found then
    return jsonb_build_object('error', 'guest_not_found');
  end if;

  select * into v_client from public.clients where id = v_guest.client_id;
  select * into v_venue  from public.venues  where id = v_guest.venue_id;

  select * into v_event
  from public.events
  where client_id = v_guest.client_id and venue_id = v_guest.venue_id
  order by event_date asc limit 1;

  select cw.slug, cw.accent_color
  into v_website_slug, v_accent_color
  from public.couple_websites cw
  where cw.client_id = v_guest.client_id
  limit 1;

  return jsonb_build_object(
    'guest', jsonb_build_object(
      'id',          v_guest.id,
      'firstName',   v_guest.first_name,
      'lastName',    v_guest.last_name,
      'rsvpStatus',  v_guest.rsvp_status,
      'rsvpNote',    v_guest.rsvp_note,
      'dietary',     v_guest.dietary_restrictions,
      'plusOne',     v_guest.plus_one,
      'plusOneName', v_guest.plus_one_name,
      'mealChoice',  v_guest.meal_choice,
      'plusOneMeal', v_guest.plus_one_meal,
      'householdId', v_guest.household_id
    ),
    'couple', jsonb_build_object(
      'firstName',        v_client.first_name,
      'partnerFirstName', v_client.partner_first_name
    ),
    'event', case when v_event.id is not null then jsonb_build_object(
      'name',      v_event.name,
      'eventDate', v_event.event_date,
      'eventType', v_event.event_type
    ) else null end,
    'venue',       jsonb_build_object('name', v_venue.name),
    'websiteSlug', v_website_slug,
    'accentColor', coalesce(v_accent_color, '#5D6F5D'),
    'mealOptions', (
      select coalesce(jsonb_agg(m.name order by m.sort_order, m.name), '[]'::jsonb)
      from public.couple_meal_options m
      where m.client_id = v_guest.client_id and m.is_active = true
    ),
    'questions', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id',               q.id,
          'questionKey',      q.question_key,
          'questionText',     q.question_text,
          'inputType',        q.input_type,
          'options',          q.options,
          'appliesToPlusOne', q.applies_to_plus_one,
          'isRequired',       q.is_required,
          'displayOrder',     q.display_order
        ) order by q.display_order
      ), '[]'::jsonb)
      from public.rsvp_questions q
      where q.client_id = v_guest.client_id and q.is_active = true
    ),
    'guestAnswers', (
      select coalesce(jsonb_agg(
        jsonb_build_object('questionId', ra.question_id, 'answer', ra.answer_text)
      ), '[]'::jsonb)
      from public.rsvp_answers ra
      where ra.guest_id = v_guest.id
    ),
    'householdMembers', (
      select case when v_guest.household_id is null then '[]'::jsonb
      else coalesce(jsonb_agg(
        jsonb_build_object(
          'id',          hm.id,
          'firstName',   hm.first_name,
          'lastName',    hm.last_name,
          'rsvpStatus',  hm.rsvp_status,
          'mealChoice',  hm.meal_choice
        )
      ), '[]'::jsonb) end
      from public.couple_guests hm
      where hm.household_id = v_guest.household_id
        and hm.id != v_guest.id
        and v_guest.household_id is not null
    )
  );
end;
$$;

grant execute on function public.preview_rsvp_as_guest(text, uuid) to anon, authenticated;
