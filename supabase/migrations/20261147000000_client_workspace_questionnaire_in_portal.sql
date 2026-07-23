-- ============================================================================
-- Client Collaboration Workspace — Questionnaire, in the portal (2026-07-22).
--
-- "The venue assigns a Questionnaire → the client immediately sees and
-- completes it." Before this, the Questionnaire only existed as a
-- standalone tokenized page (/questionnaire/[key]) with zero presence
-- inside the portal a couple actually lives in — confirmed live in the
-- architecture assessment. Reuses the exact same table, RPC-submission
-- path, and CoupleQuestionnaireForm component the standalone page already
-- uses — this is a second READ entry point (resolved via portal session
-- instead of the mailed access_key), not a parallel system.
-- ============================================================================

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
  special_requests       text
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
    q.emergency_contact_name, q.emergency_contact_phone, q.special_requests
  from public.event_questionnaires q
  join public.events e on e.id = q.event_id
  join public.venues v on v.id = q.venue_id
  where q.event_id = v_ids.event_id
    and q.venue_id = v_ids.venue_id
    -- Only once the venue has actually sent it — a coordinator's own
    -- unsent draft stays coordinator-only, same gate the standalone
    -- /questionnaire/[key] page's own "status" checks already imply.
    and q.status in ('sent', 'submitted', 'reviewed');
end;
$$;

grant execute on function public.get_questionnaire_for_portal(text) to anon, authenticated;

notify pgrst, 'reload schema';
