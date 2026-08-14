-- ============================================================================
-- Work Package D5D (continued) — real gap found while building the couple
-- experience: CoupleQuestionnaireForm holds every answer in plain React
-- state and only ever persists it once, on final submit. Close the tab,
-- lose the connection, or the couple's session simply times out before they
-- click Submit, and every answer they typed is gone — nothing exists to
-- resume from. This is the couple-side "save progress" entry point the
-- brief calls "the most important UX portion of D5D." No required-field
-- validation here — that only applies at actual submission — and it only
-- ever operates on a not-yet-submitted questionnaire (status='sent'):
-- editing a submitted questionnaire requires the coordinator's own explicit
-- reopen_questionnaire(), not a silent overwrite via autosave.
-- ============================================================================

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
  where access_key = p_key and status = 'sent';

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
      special_requests         = nullif(p_special_requests, '')
  where access_key = p_key and status = 'sent'
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

-- Coordinator-side "reopen for editing" (D5D: "reopening — explicit action
-- if supported, not automatic") is a plain authenticated UPDATE done from
-- the TS repository layer (lib/events/questionnaire.ts reopenQuestionnaire),
-- not a SECURITY DEFINER RPC — the coordinator already has a real session
-- and event_questionnaires' own RLS (venue_id = current_user_venue_id(),
-- fixed above) is sufficient. A SECURITY DEFINER function taking a
-- caller-supplied p_venue_id would bypass that check entirely, which is
-- exactly the caller-supplied-id pattern this codebase's established
-- SECURITY DEFINER functions all avoid.

notify pgrst, 'reload schema';
