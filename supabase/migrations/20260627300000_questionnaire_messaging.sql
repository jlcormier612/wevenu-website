-- ============================================================================
-- Sprint 35 — Questionnaire ↔ Messages Integration
--
-- Links questionnaires to message threads so that questionnaire lifecycle
-- events (opened, submitted) auto-create system messages in the thread.
-- This keeps all communication history — including planning milestones —
-- in one place.
-- ============================================================================

-- Link questionnaire to its message thread (nullable — questionnaires sent
-- via the Final Details tab rather than Messages don't have a thread).
alter table public.event_questionnaires
  add column thread_id uuid references public.message_threads (id) on delete set null;

-- Update mark_questionnaire_opened() to create a system message in the thread.
create or replace function public.mark_questionnaire_opened(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread_id uuid;
  v_venue_id  uuid;
begin
  -- Set opened_at once (idempotent)
  update public.event_questionnaires
    set opened_at = coalesce(opened_at, now())
  where access_key = p_key
    and opened_at is null
  returning thread_id, venue_id into v_thread_id, v_venue_id;

  -- If linked to a thread and this was the first open, create a system message
  if v_thread_id is not null and v_venue_id is not null then
    insert into public.messages (
      thread_id, venue_id, direction, body, channel, status, sent_at
    ) values (
      v_thread_id, v_venue_id,
      'system',
      '💗 The couple opened the final details form.',
      'system', 'received', now()
    );
    -- Update thread last_message_at
    update public.message_threads
      set last_message_at = now(),
          message_count   = message_count + 1
    where id = v_thread_id;
  end if;
end;
$$;

-- Update submit_questionnaire_as_couple() to create a system message on submit.
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
  p_special_requests      text
) returns jsonb
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
    set
      final_guest_count       = p_final_guest_count,
      meal_notes              = nullif(p_meal_notes, ''),
      processional_song       = nullif(p_processional_song, ''),
      recessional_song        = nullif(p_recessional_song, ''),
      first_dance_song        = nullif(p_first_dance_song, ''),
      parent_dances           = nullif(p_parent_dances, ''),
      emergency_contact_name  = nullif(p_emergency_contact, ''),
      emergency_contact_phone = nullif(p_emergency_phone, ''),
      special_requests        = nullif(p_special_requests, ''),
      status                  = 'submitted',
      submitted_at            = now()
  where access_key = p_key
    and status in ('sent', 'submitted')
  returning id, thread_id, venue_id into v_id, v_thread_id, v_venue_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'Form not found or not yet accessible.');
  end if;

  -- System message in thread on submission
  if v_thread_id is not null and v_venue_id is not null then
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

notify pgrst, 'reload schema';
