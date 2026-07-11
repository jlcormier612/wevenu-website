-- ============================================================================
-- Guest Experience — Phase 3 follow-up: get_rsvp_context still needs meal
-- options.
--
-- The main Phase 3 migration deleted the rsvp_questions row that used to
-- carry meal choices (question_key = 'meal_choice') in favor of the new
-- couple_meal_options catalog, but never repointed get_rsvp_context — the
-- guest-facing /rsvp/[token] page's actual data source — at the new table.
-- Left as-is, every guest's meal picker would have silently shown zero
-- options from this migration forward. Caught before this was reported as
-- done; fixed here rather than left as a "future phase" gap.
-- ============================================================================

create or replace function public.get_rsvp_context(p_rsvp_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest        public.couple_guests%rowtype;
  v_client       public.clients%rowtype;
  v_event        public.events%rowtype;
  v_venue        public.venues%rowtype;
  v_website_slug text;
  v_accent_color text;
begin
  select * into v_guest
  from public.couple_guests
  where rsvp_token = p_rsvp_token;

  if not found then
    return jsonb_build_object('error', 'invalid_rsvp_link');
  end if;

  select * into v_client from public.clients where id = v_guest.client_id;
  select * into v_venue  from public.venues  where id = v_guest.venue_id;

  -- Latest event for this client at this venue
  select * into v_event
  from public.events
  where client_id = v_guest.client_id and venue_id = v_guest.venue_id
  order by event_date asc limit 1;

  -- Wedding website slug + accent color
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
    -- Guest Experience — Phase 3: the one authoritative meal catalog,
    -- replacing the old rsvp_questions "meal_choice" magic key.
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

notify pgrst, 'reload schema';
