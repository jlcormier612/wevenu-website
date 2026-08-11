-- ============================================================================
-- Work Package D5D — Questionnaire Working Experience, Collaboration &
-- Completion.
--
-- Five real, in-scope changes to the existing Sprint 33/34/35/D5
-- Questionnaire system (event_questionnaires + submit_questionnaire_as_couple
-- + get_questionnaire_for_couple/portal). No parallel system, no new
-- question-type framework — the fixed field set stays exactly what it is
-- today; only which of the *optional* fields a venue chooses to show/require
-- becomes configurable, via the same Template → Working Item pattern already
-- established for Inventory (D5A) and Contracts (D2).
--
-- 1. FIX A REAL PERMISSION BUG: event_questionnaires' RLS predicate was
--    written before Sprint 107 introduced venue_staff/current_user_venue_id()
--    and was never migrated — it still checks `owner_user_id = auth.uid()`
--    directly, meaning any Coordinator/Staff (non-owner) user is silently
--    blocked from reading or writing questionnaires today. Brought in line
--    with every other venue-scoped table (event_orders, event_inventory).
--
-- 2. questionnaire_templates — a real Template → Working Questionnaire flow.
--    Configures which of the six genuinely-optional couple-facing fields
--    (meal_notes, processional_song, recessional_song, first_dance_song,
--    parent_dances, special_requests) are included and which are required.
--    The three safety/logistics fields the D5 brief already grounded in "the
--    venue can't run the event without this" (final_guest_count,
--    emergency_contact_name/phone) stay unconditionally required — not
--    template-configurable, because that was never a style preference.
--
-- 3. event_questionnaires gets template_id (provenance) + included_fields/
--    required_fields (SNAPSHOT at creation — editing a template later never
--    changes a questionnaire already in flight, same isolation guarantee
--    D5A proved for Inventory).
--
-- 4. questionnaire_activities — mirrors event_order_activities/
--    contract_activities exactly. Meaningful lifecycle events only (sent,
--    opened, submitted, reviewed) — not every field edit.
--
-- 5. submit_questionnaire_as_couple(): validates against the questionnaire's
--    own required_fields (dynamic, not hardcoded) union the three safety
--    fields; takes an optimistic-concurrency token (p_expected_updated_at,
--    same shape as D4/D5A's TS-side pattern, enforced here since this is the
--    couple's own SECURITY DEFINER write path); logs a questionnaire_activities
--    row; and — the real fix D3/D5D both name — actually notifies the
--    coordinator via create_venue_notification() on submission, the same
--    pattern D3 added for sign_contract(). Today a submission only ever
--    produces a system chat message; nothing pages the coordinator's own
--    notification feed.
-- ============================================================================

-- ---- 1. Fix the RLS permission bug ------------------------------------------
drop policy if exists event_questionnaires_all on public.event_questionnaires;

create policy event_questionnaires_all on public.event_questionnaires
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- ---- 2. questionnaire_templates ---------------------------------------------
create table public.questionnaire_templates (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,

  name          text not null check (char_length(trim(name)) > 0),
  description   text,

  included_fields text[] not null default array[
    'meal_notes','processional_song','recessional_song',
    'first_dance_song','parent_dances','special_requests'
  ]::text[]
    check (included_fields <@ array[
      'meal_notes','processional_song','recessional_song',
      'first_dance_song','parent_dances','special_requests'
    ]::text[]),

  required_fields text[] not null default array[]::text[]
    check (required_fields <@ included_fields),

  is_archived   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index questionnaire_templates_venue on public.questionnaire_templates (venue_id);

create trigger questionnaire_templates_updated_at
  before update on public.questionnaire_templates
  for each row execute function public.set_updated_at();

alter table public.questionnaire_templates enable row level security;

create policy questionnaire_templates_all on public.questionnaire_templates
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.questionnaire_templates to authenticated;

-- ---- 3. event_questionnaires: template provenance + field-config snapshot --
alter table public.event_questionnaires
  add column template_id uuid references public.questionnaire_templates (id) on delete set null,
  add column included_fields text[] not null default array[
    'meal_notes','processional_song','recessional_song',
    'first_dance_song','parent_dances','special_requests'
  ]::text[],
  add column required_fields text[] not null default array[]::text[];

-- ---- 4. questionnaire_activities --------------------------------------------
create table public.questionnaire_activities (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues (id) on delete cascade,
  questionnaire_id uuid not null references public.event_questionnaires (id) on delete cascade,

  type             text not null check (type in ('sent', 'opened', 'submitted', 'reviewed', 'reopened')),
  title            text not null,
  description      text,

  created_at       timestamptz not null default now()
);

create index questionnaire_activities_questionnaire on public.questionnaire_activities (questionnaire_id, created_at desc);

alter table public.questionnaire_activities enable row level security;

create policy questionnaire_activities_all on public.questionnaire_activities
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.questionnaire_activities to authenticated;

-- ---- 5. submit_questionnaire_as_couple(): dynamic required-fields,
--         optimistic concurrency, activity log, real coordinator notification
create or replace function public.submit_questionnaire_as_couple(
  p_key                   text,
  p_final_guest_count     integer,
  p_meal_notes            text,
  p_processional_song     text,
  p_recessional_song      text,
  p_first_dance_song      text,
  p_parent_dances         text,
  p_emergency_contact     text,
  p_emergency_phone       text,
  p_special_requests      text,
  p_expected_updated_at   timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id            uuid;
  v_venue_id      uuid;
  v_event_id      uuid;
  v_thread_id     uuid;
  v_required      text[];
  v_event_name    text;
  v_updated_at    timestamptz;
begin
  if p_final_guest_count is null then
    return jsonb_build_object('ok', false, 'error', 'Please enter your final guest count before submitting.');
  end if;
  if nullif(trim(p_emergency_contact), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add a day-of emergency contact name before submitting.');
  end if;
  if nullif(trim(p_emergency_phone), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add a day-of emergency contact phone before submitting.');
  end if;

  select q.venue_id, q.event_id, q.required_fields, q.updated_at
    into v_venue_id, v_event_id, v_required, v_updated_at
  from public.event_questionnaires q
  where q.access_key = p_key and q.status in ('sent', 'submitted');

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'Form not found or not yet accessible.');
  end if;

  if p_expected_updated_at is not null and v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale',
      'message', 'Your coordinator updated this form while you were filling it in. Please refresh to see the latest version before submitting.');
  end if;

  if 'meal_notes' = any(v_required) and nullif(trim(p_meal_notes), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add your meal preferences before submitting.');
  end if;
  if 'processional_song' = any(v_required) and nullif(trim(p_processional_song), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add your processional song before submitting.');
  end if;
  if 'recessional_song' = any(v_required) and nullif(trim(p_recessional_song), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add your recessional song before submitting.');
  end if;
  if 'first_dance_song' = any(v_required) and nullif(trim(p_first_dance_song), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add your first dance song before submitting.');
  end if;
  if 'parent_dances' = any(v_required) and nullif(trim(p_parent_dances), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add your parent dances before submitting.');
  end if;
  if 'special_requests' = any(v_required) and nullif(trim(p_special_requests), '') is null then
    return jsonb_build_object('ok', false, 'error', 'Please add your special requests before submitting.');
  end if;

  update public.event_questionnaires
    set
      final_guest_count       = p_final_guest_count,
      meal_notes               = nullif(p_meal_notes, ''),
      processional_song        = nullif(p_processional_song, ''),
      recessional_song         = nullif(p_recessional_song, ''),
      first_dance_song         = nullif(p_first_dance_song, ''),
      parent_dances            = nullif(p_parent_dances, ''),
      emergency_contact_name   = nullif(p_emergency_contact, ''),
      emergency_contact_phone  = nullif(p_emergency_phone, ''),
      special_requests         = nullif(p_special_requests, ''),
      status                   = 'submitted',
      submitted_at             = now()
  where access_key = p_key
    and status in ('sent', 'submitted')
  returning id, thread_id into v_id, v_thread_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'Form not found or not yet accessible.');
  end if;

  select e.name into v_event_name from public.events e where e.id = v_event_id;

  insert into public.questionnaire_activities (venue_id, questionnaire_id, type, title, description)
  values (v_venue_id, v_id, 'submitted', 'Final details submitted', 'Submitted by the couple');

  perform public.create_venue_notification(
    v_venue_id, v_event_id, 'questionnaire_submitted',
    'Final details submitted',
    coalesce(v_event_name, 'A couple') || ' submitted their final details form',
    '/events/' || v_event_id::text,
    '📋'
  );

  if v_thread_id is not null then
    insert into public.messages (
      thread_id, venue_id, direction, body, channel, status, sent_at
    ) values (
      v_thread_id, v_venue_id,
      'system',
      '✓ Final details submitted by the couple.',
      'system', 'received', now()
    );
    update public.message_threads
      set last_message_at = now(),
          message_count   = message_count + 1
    where id = v_thread_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_questionnaire_as_couple(
  text, integer, text, text, text, text, text, text, text, text, timestamptz
) to anon, authenticated;

-- ---- get_questionnaire_for_couple / get_questionnaire_for_portal:
--      also return included_fields/required_fields/updated_at so the couple
--      form can render only the venue's configured field set and carry a
--      concurrency token. Return shape changed — must drop first.
drop function if exists public.get_questionnaire_for_couple(text);
drop function if exists public.get_questionnaire_for_portal(text);

create or replace function public.get_questionnaire_for_couple(p_key text)
returns table (
  questionnaire_id       uuid,
  event_name             text,
  event_date             date,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  status                 text,
  final_guest_count      integer,
  meal_notes             text,
  processional_song      text,
  recessional_song       text,
  first_dance_song       text,
  parent_dances          text,
  emergency_contact_name text,
  emergency_contact_phone text,
  special_requests       text,
  included_fields        text[],
  required_fields         text[],
  updated_at              timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    q.id,
    e.name,
    e.event_date,
    v.name,
    v.logo_url,
    v.primary_color,
    q.status,
    q.final_guest_count,
    q.meal_notes,
    q.processional_song,
    q.recessional_song,
    q.first_dance_song,
    q.parent_dances,
    q.emergency_contact_name,
    q.emergency_contact_phone,
    q.special_requests,
    q.included_fields,
    q.required_fields,
    q.updated_at
  from public.event_questionnaires q
  join public.events   e on e.id = q.event_id
  join public.venues   v on v.id = q.venue_id
  where q.access_key = p_key
    and q.status in ('sent', 'submitted', 'reviewed');
$$;

grant execute on function public.get_questionnaire_for_couple(text) to anon, authenticated;

create or replace function public.get_questionnaire_for_portal(p_token text)
returns table (
  questionnaire_id       uuid,
  access_key             text,
  event_name             text,
  event_date             date,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  status                 text,
  final_guest_count      integer,
  meal_notes             text,
  processional_song      text,
  recessional_song       text,
  first_dance_song       text,
  parent_dances          text,
  emergency_contact_name text,
  emergency_contact_phone text,
  special_requests       text,
  included_fields        text[],
  required_fields         text[],
  updated_at              timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids record;
begin
  select * into v_ids from _resolve_portal_ids(p_token);
  if v_ids.client_id is null or v_ids.event_id is null then return; end if;

  return query
  select
    q.id, q.access_key,
    e.name, e.event_date,
    v.name, v.logo_url, v.primary_color,
    q.status, q.final_guest_count, q.meal_notes,
    q.processional_song, q.recessional_song, q.first_dance_song, q.parent_dances,
    q.emergency_contact_name, q.emergency_contact_phone, q.special_requests,
    q.included_fields, q.required_fields, q.updated_at
  from public.event_questionnaires q
  join public.events e on e.id = q.event_id
  join public.venues v on v.id = q.venue_id
  where q.event_id = v_ids.event_id
    and q.venue_id = v_ids.venue_id
    and q.status in ('sent', 'submitted', 'reviewed');
end;
$$;

grant execute on function public.get_questionnaire_for_portal(text) to anon, authenticated;

-- mark_questionnaire_opened(): log to questionnaire_activities too (was
-- previously silent except for the thread system-message and opened_at).
create or replace function public.mark_questionnaire_opened(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_thread_id uuid;
  v_venue_id  uuid;
begin
  update public.event_questionnaires
    set opened_at = coalesce(opened_at, now())
  where access_key = p_key
    and opened_at is null
  returning id, thread_id, venue_id into v_id, v_thread_id, v_venue_id;

  if v_id is null then return; end if;

  insert into public.questionnaire_activities (venue_id, questionnaire_id, type, title, description)
  values (v_venue_id, v_id, 'opened', 'Couple opened the form', null);

  if v_thread_id is not null then
    insert into public.messages (
      thread_id, venue_id, direction, body, channel, status, sent_at
    ) values (
      v_thread_id, v_venue_id,
      'system',
      '💗 The couple opened the final details form.',
      'system', 'received', now()
    );
    update public.message_threads
      set last_message_at = now(),
          message_count   = message_count + 1
    where id = v_thread_id;
  end if;
end;
$$;

grant execute on function public.mark_questionnaire_opened(text) to anon, authenticated;

notify pgrst, 'reload schema';
