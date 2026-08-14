-- Work Package D5 — closes a real, confirmed defect (D3 finding, restated
-- in D5's own brief): "The Questionnaire form has zero required-field
-- validation. A completely empty questionnaire can be submitted and marked
-- complete." There is no per-venue question configuration to defer to (one
-- fixed global schema, confirmed unchanged since BA1) — the required set
-- below is grounded in what the venue actually cannot run the event
-- without: final guest count (catering/seating) and a day-of emergency
-- contact (safety). Every other field on this form remains optional.
--
-- This is the couple-facing submission path's own enforcement point
-- (SECURITY DEFINER, can't be bypassed by the client). The coordinator-side
-- path (lib/events/questionnaire.ts saveQuestionnaire) enforces the exact
-- same required set at its own entry point — two real submission paths,
-- one shared rule, checked independently since one is SQL and one is TS.

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
  v_id uuid;
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

  update public.event_questionnaires
    set
      final_guest_count      = p_final_guest_count,
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
    and status in ('sent', 'submitted')  -- idempotent: allows re-submission
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', false, 'error', 'Form not found or not yet accessible.');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_questionnaire_as_couple(
  text, integer, text, text, text, text, text, text, text, text
) to anon, authenticated;

notify pgrst, 'reload schema';
