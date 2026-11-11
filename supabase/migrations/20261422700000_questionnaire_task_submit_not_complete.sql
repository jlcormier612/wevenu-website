-- ============================================================================
-- Questionnaire planning tasks must not auto-complete on couple submit.
--
-- Prior submit_questionnaire_family_as_couple marked event_tasks with
-- auto_complete_trigger = 'questionnaire_submitted' complete on every Submit.
-- Product rule: submit advances to Submitted / Needs review; Complete is only
-- when the venue finishes questionnaire review (Mark Complete → triggerAutoComplete).
-- ============================================================================

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

  -- Post-Event Feedback → couple_venue_feedback (venue review / approval model)
  if v_q.kind = 'post_event_feedback' then
    begin
      perform public.sync_couple_venue_feedback_from_pe(
        v_q.venue_id,
        v_q.event_id,
        coalesce(v_q.additional->'family', '{}'::jsonb)
      );
    exception when others then
      null;
    end;
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
      '/events/' || v_q.event_id::text || case when v_q.kind = 'post_event_feedback' then '#feedback' else '#questionnaires' end,
      '📋'
    );
  exception when others then
    null;
  end;

  -- Advance questionnaire tasks without completing.
  -- progress_state in_progress = Submitted / Needs venue review.
  -- Complete only when venue Mark Complete calls triggerAutoComplete.
  begin
    update public.event_tasks
    set
      progress_state = 'in_progress',
      status = case
        when status = 'complete' then 'pending'
        when status = 'waived' then status
        else status
      end,
      completed_at = case when status = 'complete' then null else completed_at end,
      completed_by = case when status = 'complete' then null else completed_by end,
      updated_at = now()
    where venue_id = v_q.venue_id
      and event_id = v_q.event_id
      and auto_complete_trigger = 'questionnaire_submitted'
      and status in ('pending', 'blocked', 'overdue', 'complete');
  exception when others then
    null;
  end;

  -- Do not celebrate domain completion on submit — finish line is venue review.
  v_cel := false;

  return jsonb_build_object('ok', true, 'celebrated', coalesce(v_cel, false), 'status', v_outcome);
end;
$$;


grant execute on function public.submit_questionnaire_family_as_couple(text, jsonb, timestamptz)
  to anon, authenticated;

-- Mirror progress_state when venue marks the task complete / reopens.
create or replace function public._sync_questionnaire_submitted_task_progress_on_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.auto_complete_trigger is distinct from 'questionnaire_submitted' then
    return new;
  end if;
  if new.status = 'complete' and (old.status is distinct from 'complete') then
    new.progress_state := 'complete';
  elsif new.status in ('pending', 'overdue', 'blocked')
    and old.status = 'complete'
  then
    if exists (
      select 1 from public.event_questionnaires q
      where q.event_id = new.event_id and q.venue_id = new.venue_id
        and q.status in ('submitted', 'resubmitted', 'changes_requested', 'in_progress', 'sent')
    ) then
      new.progress_state := 'in_progress';
    else
      new.progress_state := 'not_started';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_questionnaire_submitted_task_progress on public.event_tasks;
create trigger sync_questionnaire_submitted_task_progress
  before update of status on public.event_tasks
  for each row
  execute function public._sync_questionnaire_submitted_task_progress_on_complete();

notify pgrst, 'reload schema';
