-- ============================================================================
-- Sprint 73 — Guest Experience Portal & RSVPs
-- Adds: meal choice, household RSVP, custom questions, RSVP insights,
--       and smart moment journal entries.
-- Backward compatible: all new submit_rsvp() params have defaults.
-- ============================================================================

-- ── couple_guests additions ───────────────────────────────────────────────────

alter table public.couple_guests
  add column if not exists meal_choice      text,
  add column if not exists plus_one_meal    text,
  add column if not exists is_child         boolean not null default false,
  add column if not exists household_id     uuid;   -- groups household members

create index if not exists couple_guests_household
  on public.couple_guests (household_id)
  where household_id is not null;

-- ── couple_journal_entries: add source + extend milestone enum ────────────────

alter table public.couple_journal_entries
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'auto'));

-- Drop and recreate the milestone check to include RSVP milestones
alter table public.couple_journal_entries
  drop constraint if exists couple_journal_entries_milestone_check;

alter table public.couple_journal_entries
  add constraint couple_journal_entries_milestone_check check (milestone in (
    'venue_tour', 'engagement_party', 'dress_shopping', 'venue_signed',
    'save_the_dates', 'vendor_booked', 'bridal_shower', 'bachelorette',
    'rehearsal', 'wedding_day', 'other',
    'first_rsvp', 'attending_50', 'all_responded'
  ));

-- ── rsvp_questions ────────────────────────────────────────────────────────────
-- Custom questions per couple. Shown to every guest on their RSVP page.
-- The special question_key 'meal_choice' drives the meal selector UI.

create table if not exists public.rsvp_questions (
  id                uuid   primary key default gen_random_uuid(),
  client_id         uuid   not null references public.clients(id) on delete cascade,
  venue_id          uuid   not null references public.venues(id)  on delete cascade,
  question_key      text   not null,
  question_text     text   not null,
  input_type        text   not null default 'text'
    check (input_type in ('text', 'textarea', 'select', 'boolean')),
  options           jsonb,  -- string array for select types
  applies_to_plus_one boolean not null default false,
  is_required       boolean not null default false,
  display_order     int    not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique(client_id, question_key)
);

create index if not exists rsvp_questions_client
  on public.rsvp_questions (client_id, is_active, display_order);

alter table public.rsvp_questions enable row level security;

-- Venue coordinators can read their couples' questions
create policy "venue_read_rsvp_questions" on public.rsvp_questions
  for select using (
    venue_id in (
      select venue_id from public.venue_users where user_id = auth.uid()
    )
  );

-- ── rsvp_answers ──────────────────────────────────────────────────────────────

create table if not exists public.rsvp_answers (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid not null references public.couple_guests(id) on delete cascade,
  question_id uuid not null references public.rsvp_questions(id) on delete cascade,
  answer_text text,
  created_at  timestamptz not null default now(),
  unique(guest_id, question_id)
);

create index if not exists rsvp_answers_guest
  on public.rsvp_answers (guest_id);

alter table public.rsvp_answers enable row level security;

-- Venue coordinators can read answers for their couples' guests
create policy "venue_read_rsvp_answers" on public.rsvp_answers
  for select using (
    guest_id in (
      select cg.id from public.couple_guests cg
      join public.venues v on v.id = cg.venue_id
      join public.venue_users vu on vu.venue_id = v.id
      where vu.user_id = auth.uid()
    )
  );

-- ── _resolve_portal_ids ───────────────────────────────────────────────────────
-- Returns event_id, client_id, venue_id for a valid portal token.

create or replace function public._resolve_portal_ids(p_token text)
returns table(event_id uuid, client_id uuid, venue_id uuid)
language plpgsql security definer as $$
begin
  return query
  select e.id, e.client_id, e.venue_id
  from public.client_portal_sessions cps
  join public.events e on e.id = cps.event_id
  where cps.token = p_token and cps.expires_at > now()
  limit 1;
end;
$$;

-- ── submit_rsvp (updated) ─────────────────────────────────────────────────────
-- Backward compatible: all new params have defaults.

create or replace function public.submit_rsvp(
  p_rsvp_token         text,
  p_status             text,
  p_plus_one           boolean  default false,
  p_plus_one_name      text     default null,
  p_dietary            text     default null,
  p_note               text     default null,
  p_meal_choice        text     default null,
  p_plus_one_meal      text     default null,
  p_answers            jsonb    default null,
  p_household_responses jsonb   default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest             public.couple_guests%rowtype;
  v_total_responses   int;
  v_attending_count   int;
  v_pending_count     int;
  v_total_guests      int;
  v_ans               jsonb;
  v_hm                jsonb;
  v_couple_name       text;
begin
  select * into v_guest
  from public.couple_guests
  where rsvp_token = p_rsvp_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_rsvp_link');
  end if;

  if p_status not in ('attending', 'declined', 'maybe') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;

  -- Update main guest record
  update public.couple_guests
  set rsvp_status          = p_status,
      rsvp_responded_at    = now(),
      plus_one             = coalesce(p_plus_one, plus_one),
      plus_one_name        = coalesce(p_plus_one_name, plus_one_name),
      dietary_restrictions = coalesce(p_dietary, dietary_restrictions),
      rsvp_note            = coalesce(p_note, rsvp_note),
      rsvp_at              = now(),
      meal_choice          = coalesce(p_meal_choice, meal_choice),
      plus_one_meal        = coalesce(p_plus_one_meal, plus_one_meal),
      updated_at           = now()
  where rsvp_token = p_rsvp_token;

  -- Upsert custom question answers
  if p_answers is not null then
    for v_ans in select * from jsonb_array_elements(p_answers)
    loop
      begin
        insert into public.rsvp_answers (guest_id, question_id, answer_text)
        values (
          v_guest.id,
          (v_ans->>'questionId')::uuid,
          v_ans->>'answer'
        )
        on conflict (guest_id, question_id) do update
          set answer_text = excluded.answer_text;
      exception when others then null;
      end;
    end loop;
  end if;

  -- Update household members RSVPs
  if p_household_responses is not null and v_guest.household_id is not null then
    for v_hm in select * from jsonb_array_elements(p_household_responses)
    loop
      begin
        update public.couple_guests
        set rsvp_status       = v_hm->>'status',
            rsvp_responded_at = now(),
            meal_choice       = v_hm->>'mealChoice',
            updated_at        = now()
        where id             = (v_hm->>'guestId')::uuid
          and household_id   = v_guest.household_id
          and client_id      = v_guest.client_id
          and (v_hm->>'status') in ('attending', 'declined', 'maybe');
      exception when others then null;
      end;
    end loop;
  end if;

  -- Log the RSVP event
  begin
    insert into public.couple_portal_events
      (venue_id, client_id, event_type, event_data)
    values
      (v_guest.venue_id, v_guest.client_id, 'rsvp_received',
       jsonb_build_object('guestId', v_guest.id, 'status', p_status));
  exception when others then null;
  end;

  -- ── Smart Moments ───────────────────────────────────────────────────────────

  begin
    select count(*) into v_total_responses
    from public.couple_guests
    where client_id = v_guest.client_id and rsvp_status != 'pending';

    select count(*) into v_attending_count
    from public.couple_guests
    where client_id = v_guest.client_id and rsvp_status = 'attending';

    select count(*) into v_pending_count
    from public.couple_guests
    where client_id = v_guest.client_id and rsvp_status = 'pending';

    select count(*) into v_total_guests
    from public.couple_guests
    where client_id = v_guest.client_id;

    -- Resolve couple name for journal body
    select concat(c.first_name,
      case when c.partner_first_name is not null then ' & ' || c.partner_first_name else '' end)
    into v_couple_name
    from public.clients c
    where c.id = v_guest.client_id;

    -- First RSVP received
    if v_total_responses = 1 then
      if not exists (
        select 1 from public.couple_journal_entries
        where client_id = v_guest.client_id and milestone = 'first_rsvp'
      ) then
        insert into public.couple_journal_entries
          (client_id, entry_date, title, body, milestone, source)
        values (
          v_guest.client_id,
          current_date,
          'First RSVP is in! 🎉',
          v_guest.first_name || ' just responded to your invitation. The RSVPs are starting to roll in!',
          'first_rsvp',
          'auto'
        );
      end if;
    end if;

    -- 50 guests attending
    if v_attending_count = 50 then
      if not exists (
        select 1 from public.couple_journal_entries
        where client_id = v_guest.client_id and milestone = 'attending_50'
      ) then
        insert into public.couple_journal_entries
          (client_id, entry_date, title, body, milestone, source)
        values (
          v_guest.client_id,
          current_date,
          '50 guests are coming! 🥂',
          'You''ve hit a milestone — 50 people have said yes to celebrating your wedding. The party is growing!',
          'attending_50',
          'auto'
        );
      end if;
    end if;

    -- Everyone responded
    if v_pending_count = 0 and v_total_guests > 0 then
      if not exists (
        select 1 from public.couple_journal_entries
        where client_id = v_guest.client_id and milestone = 'all_responded'
      ) then
        insert into public.couple_journal_entries
          (client_id, entry_date, title, body, milestone, source)
        values (
          v_guest.client_id,
          current_date,
          'Everyone has RSVPed! 💌',
          'All ' || v_total_guests || ' guests have responded. ' || v_attending_count || ' people are celebrating with you.',
          'all_responded',
          'auto'
        );
      end if;
    end if;

  exception when others then null;
  end;

  -- Return guest context for confirmation screen
  return jsonb_build_object(
    'ok',        true,
    'guestName', v_guest.first_name,
    'status',    p_status
  );
end;
$$;

-- ── get_rsvp_context (updated) ────────────────────────────────────────────────
-- Now returns: questions, householdMembers, guestAnswers.

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

-- ── get_rsvp_insights ─────────────────────────────────────────────────────────
-- Returns response rate, meal counts, and recent RSVPs for the couple portal.

create or replace function public.get_rsvp_insights(p_token text)
returns jsonb
language plpgsql security definer as $$
declare
  v_ids     record;
  v_result  jsonb;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  select jsonb_build_object(
    'total',        count(*),
    'attending',    count(*) filter (where rsvp_status = 'attending'),
    'declined',     count(*) filter (where rsvp_status = 'declined'),
    'pending',      count(*) filter (where rsvp_status = 'pending'),
    'maybe',        count(*) filter (where rsvp_status = 'maybe'),
    'responded',    count(*) filter (where rsvp_status != 'pending'),
    'withPlusOnes', count(*) filter (where plus_one = true and rsvp_status = 'attending'),
    'childCount',   count(*) filter (where is_child = true),
    'sentCount',    count(*) filter (where rsvp_sent_at is not null)
  ) into v_result
  from public.couple_guests
  where client_id = v_ids.client_id;

  -- Meal counts (only for attending guests)
  v_result := v_result || jsonb_build_object(
    'mealCounts', (
      select coalesce(jsonb_object_agg(meal_choice, cnt), '{}'::jsonb)
      from (
        select meal_choice, count(*) as cnt
        from public.couple_guests
        where client_id = v_ids.client_id
          and rsvp_status = 'attending'
          and meal_choice is not null
        group by meal_choice
      ) mc
    ),
    'recentRsvps', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'name',        first_name || coalesce(' ' || last_name, ''),
          'status',      rsvp_status,
          'respondedAt', rsvp_responded_at
        ) order by rsvp_responded_at desc
      ), '[]'::jsonb)
      from public.couple_guests
      where client_id = v_ids.client_id
        and rsvp_responded_at is not null
      limit 5
    ),
    'milestones', (
      select coalesce(jsonb_agg(milestone), '[]'::jsonb)
      from public.couple_journal_entries
      where client_id = v_ids.client_id
        and source = 'auto'
        and milestone in ('first_rsvp', 'attending_50', 'all_responded')
    )
  );

  return jsonb_build_object('insights', v_result);
end;
$$;

-- ── upsert_rsvp_question ─────────────────────────────────────────────────────

create or replace function public.upsert_rsvp_question(
  p_token         text,
  p_id            uuid,
  p_question_key  text,
  p_question_text text,
  p_input_type    text  default 'text',
  p_options       jsonb default null,
  p_applies_plus  boolean default false,
  p_is_required   boolean default false,
  p_display_order int    default 0
) returns jsonb language plpgsql security definer as $$
declare
  v_ids record;
  v_question_id uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  if p_id is null then
    insert into public.rsvp_questions
      (client_id, venue_id, question_key, question_text, input_type, options, applies_to_plus_one, is_required, display_order)
    values
      (v_ids.client_id, v_ids.venue_id, p_question_key, p_question_text, p_input_type, p_options, p_applies_plus, p_is_required, p_display_order)
    on conflict (client_id, question_key) do update
      set question_text       = excluded.question_text,
          input_type          = excluded.input_type,
          options             = excluded.options,
          applies_to_plus_one = excluded.applies_to_plus_one,
          is_required         = excluded.is_required,
          display_order       = excluded.display_order,
          is_active           = true
    returning id into v_question_id;
  else
    update public.rsvp_questions
       set question_text       = p_question_text,
           input_type          = p_input_type,
           options             = p_options,
           applies_to_plus_one = p_applies_plus,
           is_required         = p_is_required,
           display_order       = p_display_order
     where id = p_id and client_id = v_ids.client_id
     returning id into v_question_id;
  end if;

  return jsonb_build_object('questionId', v_question_id);
end;
$$;

-- ── delete_rsvp_question ──────────────────────────────────────────────────────

create or replace function public.delete_rsvp_question(
  p_token text,
  p_id    uuid
) returns jsonb language plpgsql security definer as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  delete from public.rsvp_questions
   where id = p_id and client_id = v_ids.client_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── get_rsvp_questions ────────────────────────────────────────────────────────

create or replace function public.get_rsvp_questions(p_token text)
returns jsonb language plpgsql security definer as $$
declare v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
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
          'displayOrder',     q.display_order,
          'isActive',         q.is_active
        ) order by q.display_order, q.created_at
      ), '[]'::jsonb)
      from public.rsvp_questions q
      where q.client_id = v_ids.client_id
    )
  );
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────

grant execute on function public._resolve_portal_ids(text)                                  to anon, authenticated;
grant execute on function public.get_rsvp_context(text)                                     to anon, authenticated;
grant execute on function public.submit_rsvp(text,text,boolean,text,text,text,text,text,jsonb,jsonb) to anon, authenticated;
grant execute on function public.get_rsvp_insights(text)                                    to anon, authenticated;
grant execute on function public.upsert_rsvp_question(text,uuid,text,text,text,jsonb,boolean,boolean,int) to anon, authenticated;
grant execute on function public.delete_rsvp_question(text, uuid)                           to anon, authenticated;
grant execute on function public.get_rsvp_questions(text)                                   to anon, authenticated;

notify pgrst, 'reload schema';
