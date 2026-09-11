-- ============================================================================
-- Questionnaire review / changes-requested / resubmission loop
--
-- Product lifecycle (Documents continuation — questionnaire slice):
--   Draft → Sent → In Progress → Submitted → Review → Changes Requested
--   → Resubmitted → Review → Complete
--
-- "Review" is the venue working mode while status is submitted|resubmitted
-- (not a separate DB status). Dead `reviewed` is retired → `complete`.
-- Request Changes is distinct from administrative Reopen.
-- Submission history is append-only snapshots (not character-level edits).
-- ============================================================================

-- ---- 1. Status vocabulary ---------------------------------------------------
alter table public.event_questionnaires
  drop constraint if exists event_questionnaires_status_check;

update public.event_questionnaires
  set status = 'complete'
  where status = 'reviewed';

alter table public.event_questionnaires
  add constraint event_questionnaires_status_check
  check (status in (
    'draft',
    'sent',
    'in_progress',
    'submitted',
    'changes_requested',
    'resubmitted',
    'complete'
  ));

alter table public.event_questionnaires
  add column if not exists changes_requested_note text,
  add column if not exists changes_requested_at timestamptz;

comment on column public.event_questionnaires.changes_requested_note is
  'Venue note shown to the couple when status is changes_requested. Cleared on resubmit/complete/reopen.';
comment on column public.event_questionnaires.changes_requested_at is
  'When the venue last requested changes.';

-- ---- 2. Append-only submission snapshots ------------------------------------
create table if not exists public.questionnaire_submissions (
  id                 uuid primary key default gen_random_uuid(),
  venue_id           uuid not null references public.venues (id) on delete cascade,
  questionnaire_id   uuid not null references public.event_questionnaires (id) on delete cascade,
  event_id           uuid not null references public.events (id) on delete cascade,
  submission_number  integer not null check (submission_number > 0),
  kind               text not null,
  outcome_status     text not null check (outcome_status in ('submitted', 'resubmitted')),
  snapshot           jsonb not null,
  submitted_by       text not null default 'couple'
                     check (submitted_by in ('couple', 'venue')),
  created_at         timestamptz not null default now(),
  unique (questionnaire_id, submission_number)
);

create index if not exists questionnaire_submissions_q
  on public.questionnaire_submissions (questionnaire_id, submission_number desc);

alter table public.questionnaire_submissions enable row level security;

drop policy if exists questionnaire_submissions_venue_select on public.questionnaire_submissions;
create policy questionnaire_submissions_venue_select
  on public.questionnaire_submissions for select
  using (venue_id = public.current_user_venue_id());

-- Inserts happen only from SECURITY DEFINER couple/venue paths.
grant select on public.questionnaire_submissions to authenticated;
grant select, insert on public.questionnaire_submissions to service_role;

-- ---- 3. Activity types ------------------------------------------------------
alter table public.questionnaire_activities
  drop constraint if exists questionnaire_activities_type_check;

alter table public.questionnaire_activities
  add constraint questionnaire_activities_type_check
  check (type in (
    'sent', 'resent', 'opened', 'submitted', 'reviewed', 'reopened',
    'access_withdrawn', 'changes_requested', 'resubmitted', 'completed'
  ));

-- Historical reviewed activities remain readable; new completes use 'completed'.

-- ---- 4. Couple notification type for questionnaire changes ------------------
alter table public.couple_notifications
  drop constraint if exists couple_notifications_type_check;

alter table public.couple_notifications
  add constraint couple_notifications_type_check
  check (type in ('new_message', 'task_needs_changes', 'questionnaire_changes_requested'));

create or replace function public.create_couple_notification(
  p_client_id       uuid,
  p_type            text,
  p_title           text,
  p_body            text,
  p_link            text,
  p_conversation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_client_id is null then
    return;
  end if;

  if p_type is distinct from 'new_message'
     and p_type is distinct from 'task_needs_changes'
     and p_type is distinct from 'questionnaire_changes_requested' then
    return;
  end if;

  if exists (
    select 1
    from public.couple_notifications n
    where n.client_id = p_client_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and coalesce(n.conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and n.created_at > now() - interval '2 minutes'
  ) then
    return;
  end if;

  insert into public.couple_notifications (
    client_id, type, title, body, link, conversation_id
  ) values (
    p_client_id, p_type, p_title, p_body, p_link, p_conversation_id
  );
exception when others then
  null;
end;
$$;

grant execute on function public.create_couple_notification(uuid, text, text, text, text, uuid)
  to anon, authenticated, service_role;

-- ---- 5. Snapshot helper -----------------------------------------------------
create or replace function public._questionnaire_answer_snapshot(p_q public.event_questionnaires)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'final_guest_count', p_q.final_guest_count,
    'meal_notes', p_q.meal_notes,
    'processional_song', p_q.processional_song,
    'recessional_song', p_q.recessional_song,
    'first_dance_song', p_q.first_dance_song,
    'parent_dances', p_q.parent_dances,
    'emergency_contact_name', p_q.emergency_contact_name,
    'emergency_contact_phone', p_q.emergency_contact_phone,
    'special_requests', p_q.special_requests,
    'ceremony_start_time', p_q.ceremony_start_time,
    'reception_start_time', p_q.reception_start_time,
    'ceremony_location', p_q.ceremony_location,
    'reception_location', p_q.reception_location,
    'vendor_notes', p_q.vendor_notes,
    'additional', coalesce(p_q.additional, '{}'::jsonb)
  );
$$;

create or replace function public._record_questionnaire_submission(
  p_q public.event_questionnaires,
  p_outcome text,
  p_submitted_by text default 'couple'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  select coalesce(max(submission_number), 0) + 1 into v_n
  from public.questionnaire_submissions
  where questionnaire_id = p_q.id;

  insert into public.questionnaire_submissions (
    venue_id, questionnaire_id, event_id, submission_number,
    kind, outcome_status, snapshot, submitted_by
  ) values (
    p_q.venue_id, p_q.id, p_q.event_id, v_n,
    coalesce(p_q.kind, 'final_details'), p_outcome,
    public._questionnaire_answer_snapshot(p_q),
    p_submitted_by
  );
end;
$$;

-- ---- 6. Opened → In Progress ------------------------------------------------
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
  v_status    text;
  v_was_null  boolean;
begin
  select id, thread_id, venue_id, status, (opened_at is null)
    into v_id, v_thread_id, v_venue_id, v_status, v_was_null
  from public.event_questionnaires
  where access_key = p_key
  for update;

  if v_id is null then return; end if;
  if v_status not in ('sent', 'in_progress', 'changes_requested') then return; end if;

  update public.event_questionnaires
    set opened_at = coalesce(opened_at, now()),
        status = case when status = 'sent' then 'in_progress' else status end,
        updated_at = now()
  where id = v_id;

  if v_was_null then
    insert into public.questionnaire_activities (venue_id, questionnaire_id, type, title, description)
    values (v_venue_id, v_id, 'opened', 'Couple opened the form', null);

    if v_thread_id is not null then
      insert into public.messages (
        thread_id, venue_id, direction, body, channel, status, sent_at
      ) values (
        v_thread_id, v_venue_id,
        'system',
        '💗 The couple opened the form.',
        'system', 'received', now()
      );
      update public.message_threads
        set last_message_at = now(),
            message_count   = message_count + 1
      where id = v_thread_id;
    end if;
  end if;
end;
$$;

grant execute on function public.mark_questionnaire_opened(text) to anon, authenticated;

-- ---- 7. Family draft save — sent | in_progress | changes_requested ----------
create or replace function public.save_questionnaire_family_draft_as_couple(
  p_key text,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.event_questionnaires%rowtype;
  v_additional jsonb;
begin
  select * into v_q from public.event_questionnaires where access_key = p_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Form not found.');
  end if;
  if v_q.status not in ('sent', 'in_progress', 'changes_requested') then
    return jsonb_build_object('ok', false, 'error', 'not_editable', 'message', 'This form is not open for edits.');
  end if;
  if p_expected_updated_at is not null and v_q.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale', 'message', 'Someone else updated this form. Reload and try again.');
  end if;

  v_additional := coalesce(v_q.additional, '{}'::jsonb);
  if p_payload ? 'family' then
    v_additional := jsonb_set(v_additional, '{family}', coalesce(p_payload->'family', '{}'::jsonb), true);
  end if;

  update public.event_questionnaires set
    final_guest_count = case when p_payload ? 'final_guest_count' then nullif(p_payload->>'final_guest_count','')::integer else final_guest_count end,
    meal_notes = case when p_payload ? 'meal_notes' then nullif(p_payload->>'meal_notes','') else meal_notes end,
    processional_song = case when p_payload ? 'processional_song' then nullif(p_payload->>'processional_song','') else processional_song end,
    recessional_song = case when p_payload ? 'recessional_song' then nullif(p_payload->>'recessional_song','') else recessional_song end,
    first_dance_song = case when p_payload ? 'first_dance_song' then nullif(p_payload->>'first_dance_song','') else first_dance_song end,
    parent_dances = case when p_payload ? 'parent_dances' then nullif(p_payload->>'parent_dances','') else parent_dances end,
    emergency_contact_name = case when p_payload ? 'emergency_contact_name' then nullif(p_payload->>'emergency_contact_name','') else emergency_contact_name end,
    emergency_contact_phone = case when p_payload ? 'emergency_contact_phone' then nullif(p_payload->>'emergency_contact_phone','') else emergency_contact_phone end,
    special_requests = case when p_payload ? 'special_requests' then nullif(p_payload->>'special_requests','') else special_requests end,
    ceremony_start_time = case when p_payload ? 'ceremony_start_time' then nullif(p_payload->>'ceremony_start_time','')::time else ceremony_start_time end,
    reception_start_time = case when p_payload ? 'reception_start_time' then nullif(p_payload->>'reception_start_time','')::time else reception_start_time end,
    ceremony_location = case when p_payload ? 'ceremony_location' then nullif(p_payload->>'ceremony_location','') else ceremony_location end,
    reception_location = case when p_payload ? 'reception_location' then nullif(p_payload->>'reception_location','') else reception_location end,
    vendor_notes = case when p_payload ? 'vendor_notes' then nullif(p_payload->>'vendor_notes','') else vendor_notes end,
    additional = v_additional,
    status = case when status = 'sent' then 'in_progress' else status end,
    opened_at = coalesce(opened_at, now()),
    updated_at = now()
  where id = v_q.id
  returning updated_at into v_q.updated_at;

  return jsonb_build_object('ok', true, 'updated_at', v_q.updated_at);
end;
$$;

grant execute on function public.save_questionnaire_family_draft_as_couple(text, jsonb, timestamptz)
  to anon, authenticated;

-- Legacy draft saver — same editable statuses + in_progress promotion
create or replace function public.save_questionnaire_draft_as_couple(
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
  v_id         uuid;
  v_updated_at timestamptz;
begin
  select updated_at into v_updated_at
  from public.event_questionnaires
  where access_key = p_key and status in ('sent', 'in_progress', 'changes_requested');

  if v_updated_at is null then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  if p_expected_updated_at is not null and v_updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale',
      'message', 'Your coordinator updated this form. Refreshing to show the latest version.');
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
      status = case when status = 'sent' then 'in_progress' else status end,
      opened_at = coalesce(opened_at, now())
  where access_key = p_key and status in ('sent', 'in_progress', 'changes_requested')
  returning id, updated_at into v_id, v_updated_at;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_editable');
  end if;

  return jsonb_build_object('ok', true, 'updated_at', v_updated_at);
end;
$$;

grant execute on function public.save_questionnaire_draft_as_couple(
  text, integer, text, text, text, text, text, text, text, text, timestamptz
) to anon, authenticated;

-- ---- 8. Family submit / resubmit --------------------------------------------
create or replace function public.submit_questionnaire_family_as_couple(
  p_key text,
  p_payload jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.event_questionnaires%rowtype;
  v_additional jsonb;
  v_guest integer;
  v_cel boolean := false;
  v_outcome text;
  v_activity text;
begin
  select * into v_q from public.event_questionnaires where access_key = p_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Form not found.');
  end if;
  if v_q.status not in ('sent', 'in_progress', 'changes_requested') then
    return jsonb_build_object('ok', false, 'error', 'not_editable', 'message', 'This form is not open for submission.');
  end if;
  if p_expected_updated_at is not null and v_q.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale', 'message', 'Someone else updated this form. Reload and try again.');
  end if;

  if v_q.kind = 'final_details' then
    if coalesce(nullif(p_payload->>'emergency_contact_name',''), v_q.emergency_contact_name, '') = ''
       or coalesce(nullif(p_payload->>'emergency_contact_phone',''), v_q.emergency_contact_phone, '') = '' then
      return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'Add these before submitting: Emergency contact name, Emergency contact phone.');
    end if;
    if coalesce(
         nullif(p_payload->'family'->>'primary_day_of_contact',''),
         nullif(v_q.additional->'family'->>'primary_day_of_contact',''),
         ''
       ) = '' then
      return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'Add these before submitting: Primary day-of contact.');
    end if;
    if p_payload->>'guest_count_confirmed' is null
       and nullif(p_payload->>'final_guest_count','') is null
       and v_q.final_guest_count is null then
      return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'Add these before submitting: Guest count.');
    end if;
  end if;

  if v_q.kind = 'post_event_feedback' then
    if coalesce(nullif(p_payload->'family'->>'team_rating',''), nullif(v_q.additional->'family'->>'team_rating',''), '') = ''
       or coalesce(nullif(p_payload->'family'->>'venue_rating',''), nullif(v_q.additional->'family'->>'venue_rating',''), '') = ''
       or coalesce(nullif(p_payload->'family'->>'recommend',''), nullif(v_q.additional->'family'->>'recommend',''), '') = ''
       or coalesce(nullif(p_payload->'family'->>'share_review',''), nullif(v_q.additional->'family'->>'share_review',''), '') = '' then
      return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'Please answer the required feedback questions before submitting.');
    end if;
  end if;

  v_outcome := case when v_q.status = 'changes_requested' then 'resubmitted' else 'submitted' end;
  v_activity := v_outcome;

  v_additional := coalesce(v_q.additional, '{}'::jsonb);
  if p_payload ? 'family' then
    v_additional := jsonb_set(v_additional, '{family}', coalesce(p_payload->'family', '{}'::jsonb), true);
  end if;

  update public.event_questionnaires set
    final_guest_count = case when p_payload ? 'final_guest_count' then nullif(p_payload->>'final_guest_count','')::integer else final_guest_count end,
    meal_notes = case when p_payload ? 'meal_notes' then nullif(p_payload->>'meal_notes','') else meal_notes end,
    processional_song = case when p_payload ? 'processional_song' then nullif(p_payload->>'processional_song','') else processional_song end,
    recessional_song = case when p_payload ? 'recessional_song' then nullif(p_payload->>'recessional_song','') else recessional_song end,
    first_dance_song = case when p_payload ? 'first_dance_song' then nullif(p_payload->>'first_dance_song','') else first_dance_song end,
    parent_dances = case when p_payload ? 'parent_dances' then nullif(p_payload->>'parent_dances','') else parent_dances end,
    emergency_contact_name = case when p_payload ? 'emergency_contact_name' then nullif(p_payload->>'emergency_contact_name','') else emergency_contact_name end,
    emergency_contact_phone = case when p_payload ? 'emergency_contact_phone' then nullif(p_payload->>'emergency_contact_phone','') else emergency_contact_phone end,
    special_requests = case when p_payload ? 'special_requests' then nullif(p_payload->>'special_requests','') else special_requests end,
    ceremony_start_time = case when p_payload ? 'ceremony_start_time' then nullif(p_payload->>'ceremony_start_time','')::time else ceremony_start_time end,
    reception_start_time = case when p_payload ? 'reception_start_time' then nullif(p_payload->>'reception_start_time','')::time else reception_start_time end,
    ceremony_location = case when p_payload ? 'ceremony_location' then nullif(p_payload->>'ceremony_location','') else ceremony_location end,
    reception_location = case when p_payload ? 'reception_location' then nullif(p_payload->>'reception_location','') else reception_location end,
    vendor_notes = case when p_payload ? 'vendor_notes' then nullif(p_payload->>'vendor_notes','') else vendor_notes end,
    additional = v_additional,
    status = v_outcome,
    submitted_at = now(),
    changes_requested_note = null,
    changes_requested_at = null,
    updated_at = now()
  where id = v_q.id
  returning * into v_q;

  perform public._record_questionnaire_submission(v_q, v_outcome, 'couple');

  if (p_payload->>'guest_count_confirmed') = 'no' and nullif(p_payload->>'final_guest_count','') is not null then
    v_guest := (p_payload->>'final_guest_count')::integer;
    update public.events set guest_count = v_guest, updated_at = now()
      where id = v_q.event_id and venue_id = v_q.venue_id;
  elsif (p_payload->>'guest_count_confirmed') = 'yes' and v_q.final_guest_count is not null then
    update public.events set guest_count = coalesce(guest_count, v_q.final_guest_count), updated_at = now()
      where id = v_q.event_id and venue_id = v_q.venue_id;
  elsif nullif(p_payload->>'final_guest_count','') is not null and v_q.kind = 'final_details' then
    v_guest := (p_payload->>'final_guest_count')::integer;
    update public.events set guest_count = v_guest, updated_at = now()
      where id = v_q.event_id and venue_id = v_q.venue_id;
  end if;

  insert into public.questionnaire_activities (venue_id, questionnaire_id, type, title, description)
  values (
    v_q.venue_id, v_q.id, v_activity,
    case
      when v_outcome = 'resubmitted' then
        case v_q.kind
          when 'client_planning' then 'Client Planning Questionnaire resubmitted'
          when 'post_event_feedback' then 'Post-Event Feedback resubmitted'
          else 'Final Details resubmitted'
        end
      else
        case v_q.kind
          when 'client_planning' then 'Client Planning Questionnaire submitted'
          when 'post_event_feedback' then 'Post-Event Feedback submitted'
          else 'Final Details submitted'
        end
    end,
    null
  );

  begin
    perform public.create_venue_notification(
      v_q.venue_id,
      v_q.event_id,
      'questionnaire_submitted',
      case
        when v_outcome = 'resubmitted' then
          case v_q.kind
            when 'client_planning' then 'Client Planning Questionnaire resubmitted'
            when 'post_event_feedback' then 'Post-Event Feedback resubmitted'
            else 'Final details resubmitted'
          end
        else
          case v_q.kind
            when 'client_planning' then 'Client Planning Questionnaire submitted'
            when 'post_event_feedback' then 'Post-Event Feedback submitted'
            else 'Final details submitted'
          end
      end,
      case when v_outcome = 'resubmitted'
        then 'A couple resubmitted a form after changes were requested.'
        else 'A couple submitted a form for their celebration.'
      end,
      '/events/' || v_q.event_id::text,
      '📋'
    );
  exception when others then
    null;
  end;

  -- Complete playbook tasks on submit and resubmit (re-opened after changes).
  begin
    update public.event_tasks
      set status = 'complete',
          completed_at = now(),
          completed_by = 'system',
          updated_at = now()
    where venue_id = v_q.venue_id
      and event_id = v_q.event_id
      and auto_complete_trigger = 'questionnaire_submitted'
      and status in ('pending', 'blocked', 'overdue');
  exception when others then
    null;
  end;

  begin
    select public.celebrate_verified_domain_completion(v_q.venue_id, v_q.event_id, 'questionnaire_submitted') into v_cel;
  exception when others then
    v_cel := false;
  end;

  return jsonb_build_object('ok', true, 'celebrated', coalesce(v_cel, false), 'status', v_outcome);
end;
$$;

grant execute on function public.submit_questionnaire_family_as_couple(text, jsonb, timestamptz)
  to anon, authenticated;

-- ---- 9. Public loaders — expanded statuses + changes note -------------------
drop function if exists public.get_questionnaire_for_couple(text);

create or replace function public.get_questionnaire_for_couple(p_key text)
returns table (
  questionnaire_id       uuid,
  access_key             text,
  kind                   text,
  event_name             text,
  event_date             date,
  event_guest_count      integer,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  public_review_url      text,
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
  ceremony_start_time    text,
  reception_start_time   text,
  ceremony_location      text,
  reception_location     text,
  vendor_notes           text,
  included_fields        text[],
  required_fields        text[],
  additional             jsonb,
  updated_at             timestamptz,
  custom_fields          jsonb,
  master_overrides       jsonb,
  field_order            text[],
  changes_requested_note text,
  changes_requested_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    q.id,
    q.access_key,
    q.kind,
    e.name,
    e.event_date,
    e.guest_count,
    v.name,
    v.logo_url,
    v.primary_color,
    v.public_review_url,
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
    q.ceremony_start_time::text,
    q.reception_start_time::text,
    q.ceremony_location,
    q.reception_location,
    q.vendor_notes,
    q.included_fields,
    q.required_fields,
    q.additional,
    q.updated_at,
    coalesce(q.custom_fields, '[]'::jsonb),
    coalesce(q.master_overrides, '{}'::jsonb),
    q.field_order,
    q.changes_requested_note,
    q.changes_requested_at
  from public.event_questionnaires q
  join public.events   e on e.id = q.event_id
  join public.venues   v on v.id = q.venue_id
  where q.access_key = p_key
    and q.status in (
      'sent', 'in_progress', 'submitted', 'changes_requested',
      'resubmitted', 'complete'
    );
$$;

grant execute on function public.get_questionnaire_for_couple(text) to anon, authenticated;

drop function if exists public.get_questionnaire_for_portal(text);

create or replace function public.get_questionnaire_for_portal(p_token text)
returns table (
  questionnaire_id       uuid,
  access_key             text,
  kind                   text,
  event_name             text,
  event_date             date,
  event_guest_count      integer,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  public_review_url      text,
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
  ceremony_start_time    text,
  reception_start_time   text,
  ceremony_location      text,
  reception_location     text,
  vendor_notes           text,
  included_fields        text[],
  required_fields        text[],
  additional             jsonb,
  updated_at             timestamptz,
  custom_fields          jsonb,
  master_overrides       jsonb,
  field_order            text[],
  changes_requested_note text,
  changes_requested_at   timestamptz
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
    q.id,
    q.access_key,
    q.kind,
    e.name,
    e.event_date,
    e.guest_count,
    v.name,
    v.logo_url,
    v.primary_color,
    v.public_review_url,
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
    q.ceremony_start_time::text,
    q.reception_start_time::text,
    q.ceremony_location,
    q.reception_location,
    q.vendor_notes,
    q.included_fields,
    q.required_fields,
    q.additional,
    q.updated_at,
    coalesce(q.custom_fields, '[]'::jsonb),
    coalesce(q.master_overrides, '{}'::jsonb),
    q.field_order,
    q.changes_requested_note,
    q.changes_requested_at
  from public.event_questionnaires q
  join public.events e on e.id = q.event_id
  join public.venues v on v.id = q.venue_id
  where q.event_id = v_ids.event_id
    and q.venue_id = v_ids.venue_id
    and q.status in (
      'sent', 'in_progress', 'submitted', 'changes_requested',
      'resubmitted', 'complete'
    )
  order by
    case q.kind
      when 'client_planning' then 1
      when 'final_details' then 2
      else 3
    end,
    q.created_at;
end;
$$;

grant execute on function public.get_questionnaire_for_portal(text) to anon, authenticated;

notify pgrst, 'reload schema';
