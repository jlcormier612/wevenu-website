-- Post-Event / Feedback closeout:
-- 1) Sync Post-Event Feedback questionnaire submits into couple_venue_feedback
-- 2) Fix venue RPCs: camelCase payloads + current_user_venue_id() (staff access)
-- 3) Preserve private→public trust: permission alone never publishes; venue must approve

-- ── Helper: map PE questionnaire family payload → couple_venue_feedback ───────

create or replace function public.sync_couple_venue_feedback_from_pe(
  p_venue_id uuid,
  p_event_id uuid,
  p_family jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team int;
  v_venue int;
  v_rating int;
  v_loved text;
  v_improve text;
  v_recommend boolean;
  v_permission text;
begin
  v_team := nullif(trim(coalesce(p_family->>'team_rating', '')), '')::int;
  v_venue := nullif(trim(coalesce(p_family->>'venue_rating', '')), '')::int;

  if v_team is null and v_venue is null then
    return;
  end if;

  v_rating := greatest(coalesce(v_team, 1), coalesce(v_venue, 1));
  if v_rating < 1 then v_rating := 1; end if;
  if v_rating > 5 then v_rating := 5; end if;

  v_loved := nullif(trim(coalesce(p_family->>'did_well', '')), '');
  if v_loved is null then
    v_loved := nullif(trim(coalesce(p_family->>'future_couples_note', '')), '');
  end if;
  v_improve := nullif(trim(coalesce(p_family->>'could_improve', '')), '');
  v_recommend := lower(coalesce(p_family->>'recommend', '')) = 'yes';
  v_permission := case
    when lower(coalesce(p_family->>'share_review', '')) = 'yes' then 'review_and_names'
    else 'none'
  end;

  insert into public.couple_venue_feedback (
    venue_id, event_id, overall_rating, loved_most, could_improve,
    would_recommend, public_permission, venue_status, submitted_at
  ) values (
    p_venue_id, p_event_id, v_rating, v_loved, v_improve,
    v_recommend, v_permission, 'pending', now()
  )
  on conflict (event_id) do update set
    overall_rating = excluded.overall_rating,
    loved_most = excluded.loved_most,
    could_improve = excluded.could_improve,
    would_recommend = excluded.would_recommend,
    public_permission = excluded.public_permission,
    venue_status = case
      when public.couple_venue_feedback.venue_status = 'resolved' then 'resolved'
      else 'pending'
    end,
    -- Private or newly private: never keep a prior public approval.
    approved_for_public_at = case
      when excluded.public_permission = 'none' then null
      else public.couple_venue_feedback.approved_for_public_at
    end,
    submitted_at = now();
end;
$$;

revoke all on function public.sync_couple_venue_feedback_from_pe(uuid, uuid, jsonb) from public;
grant execute on function public.sync_couple_venue_feedback_from_pe(uuid, uuid, jsonb) to service_role;

-- ── Patch PE questionnaire submit to sync review model ───────────────────────

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

-- ── Venue read: camelCase + staff via current_user_venue_id + public review URL

create or replace function public.get_event_post_wedding_data(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id  uuid := public.current_user_venue_id();
  v_feedback  jsonb;
  v_referrals jsonb;
  v_memories  jsonb;
  v_review_url text;
begin
  if v_venue_id is null then
    return jsonb_build_object('error', 'not_found');
  end if;

  if not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.venue_id = v_venue_id
  ) then
    return jsonb_build_object('error', 'not_found');
  end if;

  select v.public_review_url into v_review_url
  from public.venues v
  where v.id = v_venue_id;

  select jsonb_build_object(
    'id', f.id,
    'overallRating', f.overall_rating,
    'lovedMost', f.loved_most,
    'couldImprove', f.could_improve,
    'wouldRecommend', f.would_recommend,
    'publicPermission', f.public_permission,
    'venueStatus', f.venue_status,
    'venueResponse', f.venue_response,
    'approvedForPublicAt', f.approved_for_public_at,
    'submittedAt', f.submitted_at,
    'isPubliclyEligible', (
      f.public_permission <> 'none'
      and f.approved_for_public_at is not null
    )
  )
  into v_feedback
  from public.couple_venue_feedback f
  where f.event_id = p_event_id and f.venue_id = v_venue_id
  limit 1;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',            r.id,
      'referralName',  r.referral_name,
      'referralEmail', r.referral_email,
      'referralPhone', r.referral_phone,
      'note',          r.note,
      'status',        r.status,
      'createdAt',     r.created_at
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_referrals
  from public.couple_referrals r
  where r.event_id = p_event_id and r.venue_id = v_venue_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'storageUrl', m.storage_url,
      'caption', m.caption,
      'visibility', m.visibility,
      'approvedAt', m.approved_at,
      'createdAt', m.created_at
    ) order by m.created_at desc
  ), '[]'::jsonb)
  into v_memories
  from public.couple_memories m
  where m.event_id = p_event_id
    and m.venue_id = v_venue_id
    and m.visibility in ('venue', 'testimonial');

  return jsonb_build_object(
    'feedback', v_feedback,
    'referrals', v_referrals,
    'memories', v_memories,
    'publicReviewUrl', v_review_url
  );
end;
$$;

grant execute on function public.get_event_post_wedding_data(uuid) to authenticated;

-- ── Venue resolve / approve: staff access + trust gate on approve ─────────────

create or replace function public.resolve_feedback(
  p_feedback_id uuid,
  p_status      text,
  p_response    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  update public.couple_venue_feedback
  set
    venue_status   = case
      when p_status in ('reviewed', 'resolved') then p_status
      else 'reviewed'
    end,
    venue_response = nullif(trim(coalesce(p_response, '')), '')
  where id = p_feedback_id
    and venue_id = v_venue_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.resolve_feedback(uuid, text, text) to authenticated;

create or replace function public.approve_feedback_public(p_feedback_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := public.current_user_venue_id();
begin
  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Trust gate: couple permission required. Never approve private feedback.
  update public.couple_venue_feedback
  set approved_for_public_at = now()
  where id = p_feedback_id
    and venue_id = v_venue_id
    and public_permission != 'none';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.approve_feedback_public(uuid) to authenticated;

-- Pure helper for tests / app logic documentation (security invoker not needed)
comment on function public.sync_couple_venue_feedback_from_pe(uuid, uuid, jsonb) is
  'Maps Post-Event Feedback questionnaire family answers into couple_venue_feedback for venue review/approval. Does not publish.';
