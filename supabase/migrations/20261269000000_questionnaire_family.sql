-- ============================================================================
-- Hello to Cheers — Questionnaire Family
--
-- Supports three working questionnaires per event (Client Planning, Final
-- Details, Post-Event Feedback) without a generic form-builder platform.
-- Answers that already belong on Event / contacts stay authoritative there;
-- questionnaire-local narrative answers live in additional.family.
-- ============================================================================

-- ---- Venues: public review destination for Post-Event Feedback ------------
alter table public.venues
  add column if not exists public_review_url text;

comment on column public.venues.public_review_url is
  'Optional URL where couples are invited to leave a public review after saying Yes on Post-Event Feedback. Null = do not invent a destination.';

-- ---- Templates: kind + master key; relax six-field-only check -------------
alter table public.questionnaire_templates
  add column if not exists kind text not null default 'final_details';

alter table public.questionnaire_templates
  drop constraint if exists questionnaire_templates_kind_check;

alter table public.questionnaire_templates
  add constraint questionnaire_templates_kind_check
  check (kind in ('client_planning', 'final_details', 'post_event_feedback'));

alter table public.questionnaire_templates
  add column if not exists source_master_key text;

alter table public.questionnaire_templates
  drop constraint if exists questionnaire_templates_included_fields_check;

alter table public.questionnaire_templates
  drop constraint if exists questionnaire_templates_check;

alter table public.questionnaire_templates
  add constraint questionnaire_templates_required_subset
  check (required_fields <@ included_fields);

create index if not exists questionnaire_templates_venue_master_key
  on public.questionnaire_templates (venue_id, source_master_key)
  where source_master_key is not null;

grant select, insert, update on public.questionnaire_templates to service_role;

-- ---- Working items: kind; one of each kind per event ----------------------
alter table public.event_questionnaires
  add column if not exists kind text not null default 'final_details';

alter table public.event_questionnaires
  drop constraint if exists event_questionnaires_kind_check;

alter table public.event_questionnaires
  add constraint event_questionnaires_kind_check
  check (kind in ('client_planning', 'final_details', 'post_event_feedback'));

-- Existing rows become Final Details (preserves production data).
update public.event_questionnaires set kind = 'final_details' where kind is null or kind = '';

alter table public.event_questionnaires
  drop constraint if exists questionnaires_one_per_event;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questionnaires_one_per_event_kind'
  ) then
    alter table public.event_questionnaires
      add constraint questionnaires_one_per_event_kind unique (event_id, kind);
  end if;
end $$;

-- Existing templates without a kind stay final_details via default.
update public.questionnaire_templates set kind = 'final_details' where kind is null or kind = '';

-- ---- Family draft / submit (jsonb payload; preserves concurrency) ---------
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
  if v_q.status <> 'sent' then
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
    updated_at = now()
  where id = v_q.id
  returning updated_at into v_q.updated_at;

  return jsonb_build_object('ok', true, 'updated_at', v_q.updated_at);
end;
$$;

grant execute on function public.save_questionnaire_family_draft_as_couple(text, jsonb, timestamptz) to anon, authenticated;

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
  v_coord uuid;
begin
  select * into v_q from public.event_questionnaires where access_key = p_key for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'message', 'Form not found.');
  end if;
  if v_q.status not in ('sent') then
    return jsonb_build_object('ok', false, 'error', 'not_editable', 'message', 'This form is not open for submission.');
  end if;
  if p_expected_updated_at is not null and v_q.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale', 'message', 'Someone else updated this form. Reload and try again.');
  end if;

  -- Final Details requires day-of emergency contact + primary day-of contact.
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

  -- Post-Event Feedback required ratings / recommendation / review comfort.
  if v_q.kind = 'post_event_feedback' then
    if coalesce(nullif(p_payload->'family'->>'team_rating',''), nullif(v_q.additional->'family'->>'team_rating',''), '') = ''
       or coalesce(nullif(p_payload->'family'->>'venue_rating',''), nullif(v_q.additional->'family'->>'venue_rating',''), '') = ''
       or coalesce(nullif(p_payload->'family'->>'recommend',''), nullif(v_q.additional->'family'->>'recommend',''), '') = ''
       or coalesce(nullif(p_payload->'family'->>'share_review',''), nullif(v_q.additional->'family'->>'share_review',''), '') = '' then
      return jsonb_build_object('ok', false, 'error', 'validation', 'message', 'Please answer the required feedback questions before submitting.');
    end if;
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
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
  where id = v_q.id;

  -- Authoritative Event guest count when couple confirms an update.
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
    v_q.venue_id, v_q.id, 'submitted',
    case v_q.kind
      when 'client_planning' then 'Client Planning Questionnaire submitted'
      when 'post_event_feedback' then 'Post-Event Feedback submitted'
      else 'Final Details submitted'
    end,
    null
  );

  -- Notify venue (same helper D5D already uses when available).
  begin
    perform public.create_venue_notification(
      v_q.venue_id,
      v_q.event_id,
      'questionnaire_submitted',
      case v_q.kind
        when 'client_planning' then 'Client Planning Questionnaire submitted'
        when 'post_event_feedback' then 'Post-Event Feedback submitted'
        else 'Final details submitted'
      end,
      'A couple submitted a form for their celebration.',
      '/events/' || v_q.event_id::text,
      '📋'
    );
  exception when others then
    null;
  end;

  begin
    select public.celebrate_verified_domain_completion(v_q.venue_id, v_q.event_id, 'questionnaire_submitted') into v_cel;
  exception when others then
    v_cel := false;
  end;

  return jsonb_build_object('ok', true, 'celebrated', coalesce(v_cel, false));
end;
$$;

grant execute on function public.submit_questionnaire_family_as_couple(text, jsonb, timestamptz) to anon, authenticated;

-- Enrich get_questionnaire_for_couple with kind/additional/context
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
  updated_at             timestamptz
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
    q.updated_at
  from public.event_questionnaires q
  join public.events   e on e.id = q.event_id
  join public.venues   v on v.id = q.venue_id
  where q.access_key = p_key
    and q.status in ('sent', 'submitted', 'reviewed');
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
  updated_at             timestamptz
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
    q.id, q.access_key, q.kind,
    e.name, e.event_date, e.guest_count,
    v.name, v.logo_url, v.primary_color, v.public_review_url,
    q.status, q.final_guest_count, q.meal_notes,
    q.processional_song, q.recessional_song, q.first_dance_song, q.parent_dances,
    q.emergency_contact_name, q.emergency_contact_phone, q.special_requests,
    q.ceremony_start_time::text, q.reception_start_time::text,
    q.ceremony_location, q.reception_location, q.vendor_notes,
    q.included_fields, q.required_fields, q.additional, q.updated_at
  from public.event_questionnaires q
  join public.events e on e.id = q.event_id
  join public.venues v on v.id = q.venue_id
  where q.event_id = v_ids.event_id
    and q.venue_id = v_ids.venue_id
    and q.status in ('sent', 'submitted', 'reviewed')
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
