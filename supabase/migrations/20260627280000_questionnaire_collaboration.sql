-- ============================================================================
-- Sprint 34 — Questionnaire Collaboration
--
-- Extends event_questionnaires to support couple-facing public access:
--   access_key  — unique URL-safe key for the couple's form link
--   sent_at     — when the coordinator sent the link
--   opened_at   — when the couple first opened the form (intent signal)
--
-- Two SECURITY DEFINER functions expose a read-only public surface:
--   get_questionnaire_for_couple()  — venue/event branding + form fields
--   submit_questionnaire_as_couple() — updates fields + status='submitted'
--
-- Status progression:
--   draft → sent (coordinator sent the link) → submitted → reviewed
-- ============================================================================

-- Tracking fields
alter table public.event_questionnaires
  add column access_key text unique
    default lower(replace(gen_random_uuid()::text, '-', '')),
  add column sent_at    timestamptz,
  add column opened_at  timestamptz;

-- Backfill existing rows
update public.event_questionnaires
  set access_key = lower(replace(gen_random_uuid()::text, '-', ''))
  where access_key is null;

alter table public.event_questionnaires
  alter column access_key set not null;

-- Update status constraint to include 'sent'
alter table public.event_questionnaires
  drop constraint event_questionnaires_status_check;

alter table public.event_questionnaires
  add constraint event_questionnaires_status_check
  check (status in ('draft', 'sent', 'submitted', 'reviewed'));

-- Index for fast public lookups
create unique index event_questionnaires_access_key
  on public.event_questionnaires (access_key);

-- ---- SECURITY DEFINER: couple form rendering --------------------------------
-- Returns event/venue branding and current field values (if any).
-- Only exposes display-safe fields to anonymous users.
create or replace function public.get_questionnaire_for_couple(p_key text)
returns table (
  questionnaire_id       uuid,
  event_name             text,
  event_date             date,
  venue_name             text,
  venue_logo_url         text,
  venue_primary_color    text,
  -- Current field values (for pre-filling)
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
    q.special_requests
  from public.event_questionnaires q
  join public.events   e on e.id = q.event_id
  join public.venues   v on v.id = q.venue_id
  where q.access_key = p_key
    and q.status in ('sent', 'submitted', 'reviewed');   -- only accessible after being sent
$$;

grant execute on function public.get_questionnaire_for_couple(text) to anon, authenticated;

-- Track that the form was opened (first page load)
create or replace function public.mark_questionnaire_opened(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_questionnaires
    set opened_at = coalesce(opened_at, now())  -- only set once
  where access_key = p_key
    and opened_at is null;
end;
$$;

grant execute on function public.mark_questionnaire_opened(text) to anon, authenticated;

-- ---- SECURITY DEFINER: couple submission ------------------------------------
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
  update public.event_questionnaires
    set
      final_guest_count      = p_final_guest_count,
      meal_notes             = nullif(p_meal_notes, ''),
      processional_song      = nullif(p_processional_song, ''),
      recessional_song       = nullif(p_recessional_song, ''),
      first_dance_song       = nullif(p_first_dance_song, ''),
      parent_dances          = nullif(p_parent_dances, ''),
      emergency_contact_name = nullif(p_emergency_contact, ''),
      emergency_contact_phone = nullif(p_emergency_phone, ''),
      special_requests       = nullif(p_special_requests, ''),
      status                 = 'submitted',
      submitted_at           = now()
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
