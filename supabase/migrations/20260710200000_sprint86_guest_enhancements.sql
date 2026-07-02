-- ============================================================================
-- Sprint 86: Guest List Enhancements
--
-- 1. Add is_child flag to couple_guests
-- 2. Update add_couple_guest RPC to accept p_is_child
-- 3. Update get_couple_guests to return isChild + plusOneName
-- 4. Fix get_rsvp_questions: add is_active = true filter
-- 5. Fix upsert_rsvp_question: explicitly set is_active = true on insert
-- ============================================================================


-- ── 1. is_child column ───────────────────────────────────────────────────────

alter table public.couple_guests
  add column if not exists is_child boolean not null default false;

comment on column public.couple_guests.is_child is
  'True for children — affects meal counts, seating, and RSVP question logic';


-- ── 2. Updated add_couple_guest ───────────────────────────────────────────────

create or replace function public.add_couple_guest(
  p_token      text,
  p_first_name text,
  p_last_name  text,
  p_email      text,
  p_plus_one   boolean default false,
  p_plus_one_name text default '',
  p_group_label text default '',
  p_dietary    text default '',
  p_is_child   boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_id      uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  insert into public.couple_guests
    (venue_id, client_id, first_name, last_name, email,
     plus_one, plus_one_name, group_label, dietary_restrictions, is_child)
  values
    (v_session.venue_id, v_session.client_id,
     trim(p_first_name),
     nullif(trim(p_last_name), ''),
     nullif(trim(p_email), ''),
     coalesce(p_plus_one, false),
     nullif(trim(coalesce(p_plus_one_name, '')), ''),
     nullif(trim(coalesce(p_group_label, '')), ''),
     nullif(trim(coalesce(p_dietary, '')), ''),
     coalesce(p_is_child, false))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'guestId', v_id);
end;
$$;

grant execute on function public.add_couple_guest(text,text,text,text,boolean,text,text,text,boolean)
  to anon, authenticated;


-- ── 3. Updated get_couple_guests ─────────────────────────────────────────────
-- Now returns isChild, plusOneName, mealChoice, rsvpToken

create or replace function public.get_couple_guests(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  return jsonb_build_object(
    'guests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',           g.id,
          'firstName',    g.first_name,
          'lastName',     g.last_name,
          'email',        g.email,
          'isChild',      g.is_child,
          'plusOne',      g.plus_one,
          'plusOneName',  g.plus_one_name,
          'rsvpStatus',   g.rsvp_status,
          'rsvpNote',     g.rsvp_note,
          'dietary',      g.dietary_restrictions,
          'groupLabel',   g.group_label,
          'notes',        g.notes,
          'rsvpToken',    g.rsvp_token
        ) order by g.sort_order, g.first_name
      )
      from public.couple_guests g
      where g.client_id = v_session.client_id
        and g.venue_id  = v_session.venue_id
    ), '[]'::jsonb),
    'stats', (
      select jsonb_build_object(
        'total',         count(*),
        'attending',     count(*) filter (where rsvp_status = 'attending'),
        'declined',      count(*) filter (where rsvp_status = 'declined'),
        'pending',       count(*) filter (where rsvp_status = 'pending'),
        'children',      count(*) filter (where is_child = true),
        'withPlusOnes',  count(*) filter (where plus_one = true and rsvp_status = 'attending')
      )
      from public.couple_guests
      where client_id = v_session.client_id and venue_id = v_session.venue_id
    )
  );
end;
$$;

grant execute on function public.get_couple_guests(text) to anon, authenticated;


-- ── 4. Fix get_rsvp_questions — add is_active filter ─────────────────────────

create or replace function public.get_rsvp_questions(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids record;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

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
        and q.is_active = true
    )
  );
end;
$$;

grant execute on function public.get_rsvp_questions(text) to anon, authenticated;


-- ── 5. Fix upsert_rsvp_question — explicit is_active = true on insert ────────

create or replace function public.upsert_rsvp_question(
  p_token         text,
  p_id            uuid,
  p_question_key  text,
  p_question_text text,
  p_input_type    text    default 'text',
  p_options       jsonb   default null,
  p_applies_plus  boolean default false,
  p_is_required   boolean default false,
  p_display_order int     default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids         record;
  v_question_id uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  if p_id is null then
    -- Insert — explicitly set is_active = true so no ambiguity
    insert into public.rsvp_questions
      (client_id, venue_id, question_key, question_text, input_type, options,
       applies_to_plus_one, is_required, display_order, is_active)
    values
      (v_ids.client_id, v_ids.venue_id, p_question_key, p_question_text,
       p_input_type, p_options, p_applies_plus, p_is_required, p_display_order, true)
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
     where id = p_id
       and client_id = v_ids.client_id
     returning id into v_question_id;
  end if;

  return jsonb_build_object('questionId', v_question_id);
end;
$$;

grant execute on function public.upsert_rsvp_question(text,uuid,text,text,text,jsonb,boolean,boolean,int)
  to anon, authenticated;


notify pgrst, 'reload schema';
