-- ============================================================================
-- Floor Plans Phase 2 — decouple couple preference from working layout, sharing, seating
--
-- Contract (v1.5 §9.2 / C2 / C1 / C3):
-- * select_portal_floor_plan_offer records preference only (pending). Does NOT set
--   operational_floor_plan_id, shared_with_couple, or client_access.
-- * ensure_portal_floor_plan_assignment no longer auto-selects or heals seating from preference.
-- * Preference lifecycle columns distinct from floor_plans.client_layout_status.
-- * seating_in_use_floor_plan_id is explicit (C1), independent of operational / preference.
-- * Does not mutate Library templates. Does not delete seating or layouts.
-- ============================================================================

-- ── 1. Preference lifecycle + seating-in-use (events) ────────────────────────
alter table public.events
  add column if not exists couple_preference_status text;

alter table public.events
  add column if not exists couple_approved_floor_plan_id uuid
    references public.floor_plans (id) on delete set null;

alter table public.events
  add column if not exists seating_in_use_floor_plan_id uuid
    references public.floor_plans (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_couple_preference_status_check'
  ) then
    alter table public.events
      add constraint events_couple_preference_status_check
      check (
        couple_preference_status is null
        or couple_preference_status in (
          'pending', 'approved', 'declined', 'deferred', 'withdrawn', 'superseded'
        )
      );
  end if;
end $$;

comment on column public.events.couple_preference_status is
  'Phase 2: lifecycle of couple_selected_floor_plan_id (pending/approved/declined/deferred/withdrawn/superseded). Distinct from floor_plans.client_layout_status.';

comment on column public.events.couple_approved_floor_plan_id is
  'Phase 2: last venue-approved couple preference. Preserved when a later preference is declined, deferred, withdrawn, or superseded.';

comment on column public.events.seating_in_use_floor_plan_id is
  'Phase 2: explicit seating-in-use designation (C1). Independent of operational_floor_plan_id and couple preference.';

create index if not exists events_couple_approved_floor_plan
  on public.events (couple_approved_floor_plan_id)
  where couple_approved_floor_plan_id is not null;

create index if not exists events_seating_in_use_floor_plan
  on public.events (seating_in_use_floor_plan_id)
  where seating_in_use_floor_plan_id is not null;

-- Legacy: pointer without status → pending (do not invent approval).
update public.events
set couple_preference_status = 'pending'
where couple_selected_floor_plan_id is not null
  and couple_preference_status is null;

create or replace function public.validate_couple_approved_floor_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.couple_approved_floor_plan_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.floor_plans fp
    where fp.id = new.couple_approved_floor_plan_id
      and fp.event_id = new.id
      and fp.venue_id = new.venue_id
  ) then
    raise exception 'couple_approved_floor_plan_id must reference a floor plan on the same event';
  end if;
  return new;
end;
$$;

drop trigger if exists events_couple_approved_floor_plan_validate on public.events;
create trigger events_couple_approved_floor_plan_validate
  before insert or update of couple_approved_floor_plan_id on public.events
  for each row execute function public.validate_couple_approved_floor_plan();

create or replace function public.validate_seating_in_use_floor_plan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.seating_in_use_floor_plan_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.floor_plans fp
    where fp.id = new.seating_in_use_floor_plan_id
      and fp.event_id = new.id
      and fp.venue_id = new.venue_id
  ) then
    raise exception 'seating_in_use_floor_plan_id must reference a floor plan on the same event';
  end if;
  return new;
end;
$$;

drop trigger if exists events_seating_in_use_floor_plan_validate on public.events;
create trigger events_seating_in_use_floor_plan_validate
  before insert or update of seating_in_use_floor_plan_id on public.events
  for each row execute function public.validate_seating_in_use_floor_plan();

-- ── 2. select: preference only ───────────────────────────────────────────────
create or replace function public.select_portal_floor_plan_offer(
  p_token text,
  p_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_offer public.event_floor_plan_offers%rowtype;
  v_template public.floor_plan_templates%rowtype;
  v_plan_id uuid;
  v_plan_name text;
  v_prev_selected uuid;
  v_prev_status text;
  v_approved uuid;
  v_superseded boolean := false;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  select * into v_offer
  from public.event_floor_plan_offers o
  where o.id = p_offer_id
    and o.event_id = v_ids.event_id
    and o.venue_id = v_ids.venue_id
    and o.is_offered = true;

  if not found then
    return jsonb_build_object('error', 'not_found_or_not_offered');
  end if;

  select * into v_template
  from public.floor_plan_templates t
  where t.id = v_offer.floor_plan_template_id
    and t.venue_id = v_ids.venue_id
    and t.is_archived = false;

  if not found then
    return jsonb_build_object('error', 'template_unavailable');
  end if;

  select fp.id into v_plan_id
  from public.floor_plans fp
  where fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.source_template_id = v_template.id
  order by fp.created_at asc
  limit 1;

  if v_plan_id is null then
    v_plan_name := coalesce(nullif(trim(v_offer.couple_label), ''), v_template.name);

    insert into public.floor_plans (
      venue_id, event_id, name, space_id,
      background_image_url, background_image_opacity,
      room_width_ft, room_depth_ft, measurement_unit,
      source_template_id,
      shared_with_couple,
      client_access
    ) values (
      v_ids.venue_id, v_ids.event_id, v_plan_name, v_template.space_id,
      v_template.background_image_url, v_template.background_image_opacity,
      v_template.room_width_ft, v_template.room_depth_ft, v_template.measurement_unit,
      v_template.id,
      false,
      'hidden'
    )
    returning id into v_plan_id;

    insert into public.floor_plan_objects (
      venue_id, floor_plan_id, object_type, label, capacity,
      x, y, width, height, rotation, sort_order,
      inventory_item_id, color, notes, locked, display_shape
    )
    select
      v_ids.venue_id, v_plan_id, tobj.object_type, tobj.label, tobj.capacity,
      tobj.x, tobj.y, tobj.width, tobj.height, tobj.rotation, tobj.sort_order,
      tobj.inventory_item_id, tobj.color, tobj.notes, tobj.locked, tobj.display_shape
    from public.floor_plan_template_objects tobj
    where tobj.template_id = v_template.id
    order by tobj.sort_order, tobj.created_at;
  end if;

  select e.couple_selected_floor_plan_id, e.couple_preference_status, e.couple_approved_floor_plan_id
  into v_prev_selected, v_prev_status, v_approved
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_prev_selected is not null
     and v_prev_selected is distinct from v_plan_id
     and coalesce(v_prev_status, 'pending') = 'pending' then
    v_superseded := true;
  end if;

  -- Preference only. Preserve approved pointer. Do not touch operational / share / seating.
  update public.events
  set
    couple_selected_floor_plan_id = v_plan_id,
    couple_preference_status = 'pending'
  where id = v_ids.event_id
    and venue_id = v_ids.venue_id;

  return jsonb_build_object(
    'ok', true,
    'floorPlanId', v_plan_id,
    'templateId', v_template.id,
    'offerId', v_offer.id,
    'preferenceStatus', 'pending',
    'supersededPriorPending', v_superseded,
    'approvedFloorPlanId', v_approved,
    'autoAssigned', false
  );
end;
$$;

comment on function public.select_portal_floor_plan_offer(text, uuid) is
  'Phase 2: couple preference only (pending). Does not set operational_floor_plan_id, shared_with_couple, or client_access. Preserves couple_approved_floor_plan_id.';

-- ── 3. portal ensure: no preference auto-assign / no seating heal ────────────
create or replace function public.ensure_portal_floor_plan_assignment(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_selected uuid;
  v_status text;
  v_offer_count int;
  v_shared_count int;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  select e.couple_selected_floor_plan_id, e.couple_preference_status
  into v_selected, v_status
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  select count(*)::int into v_shared_count
  from public.floor_plans fp
  where fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true;

  select count(*)::int into v_offer_count
  from public.event_floor_plan_offers o
  join public.floor_plan_templates t on t.id = o.floor_plan_template_id
  where o.event_id = v_ids.event_id
    and o.venue_id = v_ids.venue_id
    and o.is_offered = true
    and t.is_archived = false;

  if v_selected is not null then
    return jsonb_build_object(
      'ok', true,
      'floorPlanId', v_selected,
      'preferenceStatus', coalesce(v_status, 'pending'),
      'autoAssigned', false,
      'reason', 'already_selected'
    );
  end if;

  if v_offer_count = 0 and v_shared_count = 0 then
    return jsonb_build_object('ok', true, 'floorPlanId', null, 'autoAssigned', false, 'reason', 'no_offers');
  end if;

  if v_offer_count > 1 then
    return jsonb_build_object('ok', true, 'floorPlanId', null, 'autoAssigned', false, 'reason', 'needs_selection');
  end if;

  -- Sole offer: do not invent preference or operational from offer count.
  -- Couple sees layouts the venue has shared; preference remains optional.
  return jsonb_build_object(
    'ok', true,
    'floorPlanId', null,
    'autoAssigned', false,
    'reason', case when v_shared_count > 0 then 'sole_offer_shared' else 'sole_offer_awaiting_share' end
  );
end;
$$;

comment on function public.ensure_portal_floor_plan_assignment(text) is
  'Phase 2: reports preference/share state only. Does not auto-select, set operational, or heal seating from preference.';

-- ── 4. Portal list / detail: expose preference + approved + seating-in-use ────
-- Preserves client-submit review fields (230) and capacity context (231).
create or replace function public.get_portal_floor_plans(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_operational uuid;
  v_couple_selected uuid;
  v_pref_status text;
  v_approved uuid;
  v_seating_in_use uuid;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object(
      'floorPlans', '[]'::jsonb,
      'operationalFloorPlanId', null,
      'coupleSelectedFloorPlanId', null,
      'couplePreferenceStatus', null,
      'coupleApprovedFloorPlanId', null,
      'seatingInUseFloorPlanId', null
    );
  end if;

  select
    e.operational_floor_plan_id,
    e.couple_selected_floor_plan_id,
    e.couple_preference_status,
    e.couple_approved_floor_plan_id,
    e.seating_in_use_floor_plan_id
  into v_operational, v_couple_selected, v_pref_status, v_approved, v_seating_in_use
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_couple_selected is not null and v_pref_status is null then
    v_pref_status := 'pending';
  end if;

  return jsonb_build_object(
    'operationalFloorPlanId', v_operational,
    'coupleSelectedFloorPlanId', v_couple_selected,
    'couplePreferenceStatus', v_pref_status,
    'coupleApprovedFloorPlanId', v_approved,
    'seatingInUseFloorPlanId', v_seating_in_use,
    'floorPlans', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', fp.id,
          'name', fp.name,
          'isOperational', (v_operational is not null and fp.id = v_operational),
          'isCoupleSelected', (v_couple_selected is not null and fp.id = v_couple_selected),
          'isCoupleApproved', (v_approved is not null and fp.id = v_approved),
          'isSeatingInUse', (v_seating_in_use is not null and fp.id = v_seating_in_use),
          'isReady', (fp.finalized_at is not null),
          'clientLayoutStatus', coalesce(fp.client_layout_status, 'working'),
          'clientSubmittedAt', fp.client_submitted_at,
          'clientReviewNote', fp.client_review_note,
          'clientReviewedAt', fp.client_reviewed_at,
          'coupleMayAddTables', coalesce(fp.couple_may_add_tables, true),
          'spaceId', fp.space_id,
          'createdAt', fp.created_at
        )
        order by fp.created_at asc
      )
      from public.floor_plans fp
      where fp.event_id = v_ids.event_id
        and fp.venue_id = v_ids.venue_id
        and fp.shared_with_couple = true
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_floor_plans(text) to anon, authenticated;

create or replace function public.get_portal_floor_plan(p_token text, p_floor_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ids record;
  v_operational uuid;
  v_couple_selected uuid;
  v_pref_status text;
  v_approved uuid;
  v_seating_in_use uuid;
  v_plan public.floor_plans%rowtype;
  v_guest_count integer;
  v_space_id uuid;
  v_space_name text;
  v_space_capacity integer;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.event_id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;
  if v_ids.access_level = 'financial' then
    return jsonb_build_object('error', 'insufficient_access');
  end if;

  select * into v_plan
  from public.floor_plans fp
  where fp.id = p_floor_plan_id
    and fp.event_id = v_ids.event_id
    and fp.venue_id = v_ids.venue_id
    and fp.shared_with_couple = true;

  if not found then
    return jsonb_build_object('error', 'not_found_or_not_shared');
  end if;

  select
    e.operational_floor_plan_id,
    e.couple_selected_floor_plan_id,
    e.couple_preference_status,
    e.couple_approved_floor_plan_id,
    e.seating_in_use_floor_plan_id,
    e.guest_count,
    e.space_id
  into v_operational, v_couple_selected, v_pref_status, v_approved, v_seating_in_use, v_guest_count, v_space_id
  from public.events e
  where e.id = v_ids.event_id and e.venue_id = v_ids.venue_id;

  if v_couple_selected is not null and v_pref_status is null then
    v_pref_status := 'pending';
  end if;

  v_space_id := coalesce(v_plan.space_id, v_space_id);

  if v_space_id is not null then
    select vs.name, vs.capacity
    into v_space_name, v_space_capacity
    from public.venue_spaces vs
    where vs.id = v_space_id
      and vs.venue_id = v_ids.venue_id;
  end if;

  return jsonb_build_object(
    'couplePreferenceStatus', v_pref_status,
    'coupleApprovedFloorPlanId', v_approved,
    'seatingInUseFloorPlanId', v_seating_in_use,
    'plan', jsonb_build_object(
      'id', v_plan.id,
      'name', v_plan.name,
      'spaceId', v_plan.space_id,
      'isOperational', (v_operational is not null and v_plan.id = v_operational),
      'isCoupleSelected', (v_couple_selected is not null and v_plan.id = v_couple_selected),
      'isCoupleApproved', (v_approved is not null and v_plan.id = v_approved),
      'isSeatingInUse', (v_seating_in_use is not null and v_plan.id = v_seating_in_use),
      'isReady', (v_plan.finalized_at is not null),
      'clientLayoutStatus', coalesce(v_plan.client_layout_status, 'working'),
      'clientSubmittedAt', v_plan.client_submitted_at,
      'clientReviewNote', v_plan.client_review_note,
      'clientReviewedAt', v_plan.client_reviewed_at,
      'coupleMayAddTables', coalesce(v_plan.couple_may_add_tables, true),
      'backgroundImageUrl', v_plan.background_image_url,
      'backgroundImageOpacity', v_plan.background_image_opacity,
      'roomWidthFt', v_plan.room_width_ft,
      'roomDepthFt', v_plan.room_depth_ft,
      'measurementUnit', v_plan.measurement_unit,
      'notes', v_plan.notes
    ),
    'eventGuestCount', v_guest_count,
    'spaceName', v_space_name,
    'spaceCapacity', v_space_capacity,
    'objects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'objectType', o.object_type,
          'label', o.label,
          'capacity', o.capacity,
          'x', o.x,
          'y', o.y,
          'width', o.width,
          'height', o.height,
          'rotation', o.rotation,
          'sortOrder', o.sort_order,
          'color', o.color,
          'notes', o.notes,
          'displayShape', o.display_shape,
          'inventoryItemId', o.inventory_item_id,
          'locked', coalesce(o.locked, false)
        )
        order by o.sort_order, o.created_at
      )
      from public.floor_plan_objects o
      where o.floor_plan_id = v_plan.id
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_portal_floor_plan(text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';

-- ── 5. Venue export allowlist (preference lifecycle coherence)
-- Venue export: include Floor Plans Phase 2 preference lifecycle + seating-in-use
-- on events allowlist. Complements couple_selected / operational already exported.
-- Does not invent approval. Does not change portal export.

create or replace function public.get_venue_export(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb := '{}'::jsonb;
  spec record;
  chunk jsonb;
begin
  if not public.venue_export_allowed(p_venue_id) then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  for spec in
    select * from (values
      ('venues', 'id', 'accent_color,accepted_inquiry_event_types,access_disabled,account_status,address_line1,address_line2,allow_simultaneous_public_availability,allow_tours_during_booked_events,business_name,capacity,city,commercial_booking_prefs,communication_test_email_at,communication_test_sms_at,conversation_experience_enabled,country,created_at,currency,email,email_footer_show_email,email_footer_show_phone,email_footer_show_signature,email_intake_connected_at,email_signature,event_order_enabled,ga4_measurement_id,hero_image_url,hold_blocks_availability,id,inquiry_communication_settings,inquiry_event_date_mode,inquiry_form_fields,logo_url,name,neutral_color,onboarding_dismissed,onboarding_persona,owner_user_id,phone,planning_floor_plan_enabled,planning_seating_enabled,planning_timeline_enabled,planning_vendors_enabled,postal_code,primary_color,public_review_url,secondary_color,setup_completed,setup_completed_at,setup_last_step,space_operating_mode,state_region,story,stripe_accepted_payment_methods,stripe_charges_enabled,stripe_charges_enabled_verified_at,stripe_onboarding_status,timezone,tour_buffer_minutes,tour_duration_minutes,tour_max_advance_days,tour_min_notice_hours,tour_page_description,tour_page_headline,tour_protection_fee_cents,tour_protection_mode,tour_scheduling_enabled,updated_at,venue_type,website,week_starts_on'),
      ('venue_business_hours', 'venue_id', 'close_time,day_of_week,id,is_open,open_time,venue_id'),
      ('venue_spaces', 'venue_id', 'capacity,created_at,description,id,is_active,name,permitted_uses,sort_order,updated_at,venue_id'),
      ('venue_capacity_rules', 'venue_id', 'created_at,id,max_simultaneous_events,max_simultaneous_tours,min_turnaround_hours,updated_at,venue_id'),
      ('venue_operational_info', 'venue_id', 'ceremony_instructions,created_at,faqs,hotel_blocks,id,important_contacts,nearby_accommodations,parking_info,policies,rain_plan,section_audiences,section_overrides,things_to_do,transportation,updated_at,venue_id'),
      ('venue_schedule_item_types', 'venue_id', 'archived_at,blocks_availability,builtin_key,created_at,custom_key,enabled,group_key,id,label,sort_order,source,updated_at,venue_id'),
      ('venue_reminder_cadence', 'venue_id', 'contract_before_due_offsets,payment_after_due_cadence,payment_before_due_offsets,task_after_due_cadence,updated_at,venue_id'),
      ('venue_notification_preferences', 'venue_id', 'channel_email,channel_push,channel_sms,daily_digest_enabled,digest_intro_dismissed,last_digest_sent_at,pref_client_submitted_info,pref_contract_requires_attention,pref_contract_signed,pref_feedback_received,pref_final_guest_count_submitted,pref_message_received,pref_new_lead,pref_payment_failed,pref_payment_overdue,pref_payment_received,pref_proposal_accepted,pref_referral_received,pref_rsvp_received,pref_task_completed,pref_tour_confirmed,pref_tour_scheduled,pref_vendor_checked_in,updated_at,venue_id'),
      ('venue_required_vendor_categories', 'venue_id', 'category,created_at,id,venue_id'),
      ('tour_availability_windows', 'venue_id', 'created_at,day_of_week,end_time,id,sort_order,start_time,updated_at,venue_id'),
      ('tour_availability_exceptions', 'venue_id', 'created_at,end_date,id,label,recurrence_rule,start_date,updated_at,venue_id'),
      ('calendar_blocks', 'venue_id', 'blocks_availability,client_id,client_name,converted_lead_id,created_at,end_date,end_time,estimated_revenue,event_type,guest_count,id,is_all_day,lead_id,notes,reason,recurrence_count,recurrence_ends_on,recurrence_interval,recurrence_rule,schedule_item_type_id,start_date,start_time,title,type,venue_id'),
      ('date_holds', 'venue_id', 'created_at,end_date,end_time,expires_at,hold_date,id,lead_id,notes,preference_id,space_id,start_time,status,title,updated_at,venue_id'),
      ('date_hold_spaces', 'venue_id', 'created_at,hold_id,id,space_id,venue_id'),
      ('venue_lead_capture_channels', 'venue_id', 'channel,configured_at,created_at,id,updated_at,venue_id,verified_at'),
      ('public_forms', 'venue_id', 'created_at,description,field_config,id,internal_name,public_key,public_title,status,updated_at,venue_id'),
      ('public_form_questions', 'venue_id', 'created_at,id,options,public_form_id,question_text,question_type,required,sort_order,updated_at,venue_id'),
      ('inquiry_form_questions', 'venue_id', 'created_at,id,options,question_text,question_type,required,sort_order,updated_at,venue_id'),
      ('clients', 'venue_id', 'ceremony_time,created_at,email,end_date,event_date,event_type,exclude_from_business_reporting,first_name,guest_count,id,import_batch_id,internal_notes,is_historical_import,last_name,lead_id,lifecycle_booked_at,lifecycle_booking_origin,partner_email,partner_first_name,partner_last_name,phone,preferred_communication_channels,quickbooks_customer_id,quickbooks_sync_status,quickbooks_synced_at,reception_time,rehearsal_date,relationship_id,status,updated_at,venue_id'),
      ('client_contacts', 'venue_id', 'client_id,created_at,email,first_name,id,invited_at,is_decision_maker,is_emergency_contact,is_payer,is_primary,last_activity_at,last_name,notes,phone,portal_role,receives_reminders,relationship,role_label,sort_order,status,updated_at,venue_id'),
      ('client_notes', 'venue_id', 'body,client_id,created_at,id,updated_at,venue_id'),
      ('client_activities', 'venue_id', 'client_id,created_at,description,id,title,type,venue_id'),
      ('client_media', 'venue_id', 'caption,category,client_id,created_at,file_name,file_size_bytes,file_url,id,media_type,mime_type,sort_order,uploaded_by_contact_id,venue_id,visibility'),
      ('client_invitations', 'venue_id', 'accepted_at,client_id,created_at,delivered_at,delivery_error,delivery_status,email,expires_at,id,invited_by,provider_message_id,status,venue_id'),
      ('leads', 'venue_id', 'acquisition_source,assigned_staff_id,commitment_score,created_at,email,end_date,estimated_budget,event_date,event_type,exclude_from_business_reporting,first_booked_at,first_name,follow_up_date,guest_count,id,import_batch_id,inquiry_date,inquiry_message,inquiry_message_origin,intake_confidence,interest_score,is_historical_import,last_contacted_at,last_name,lost_at,lost_reason,lost_reason_detail,next_action_due,next_action_text,partner_email,partner_first_name,partner_last_name,phone,pipeline_stage_id,planned_event_space_id,preferred_communication_channels,relationship_id,responsiveness_score,sales_stage,scores_updated_at,source,source_data,status,updated_at,venue_id,venue_seen_at'),
      ('lead_notes', 'venue_id', 'body,created_at,id,lead_id,updated_at,venue_id'),
      ('lead_activities', 'venue_id', 'created_at,description,id,lead_id,title,type,venue_id'),
      ('lead_tasks', 'venue_id', 'assigned_to_staff_id,completed,completed_at,created_at,due_date,id,lead_id,title,venue_id'),
      ('lead_event_space_preferences', 'venue_id', 'created_at,external_location,id,lead_id,preference_kind,scheduled_date,space_id,updated_at,use_key,venue_id'),
      ('events', 'venue_id', 'assigned_staff_id,booked_at,booking_celebration_pending,client_id,couple_approved_floor_plan_id,couple_preference_status,couple_selected_floor_plan_id,created_at,end_time,event_date,event_end_date,event_type,exclude_from_business_reporting,external_ceremony_location,external_reception_location,guest_count,id,name,operational_floor_plan_id,seating_in_use_floor_plan_id,setup_time,space_id,start_time,status,teardown_time,updated_at,venue_id'),
      ('event_notes', 'venue_id', 'body,created_at,event_id,id,updated_at,venue_id'),
      ('event_activities', 'venue_id', 'created_at,description,event_id,id,title,type,venue_id'),
      ('event_space_assignments', 'venue_id', 'created_at,end_time,event_id,id,scheduled_date,sort_order,space_id,start_time,updated_at,use_key,use_label,venue_id'),
      ('event_team', 'venue_id', 'created_at,event_id,full_name,id,phone,role,venue_id'),
      ('event_setup_states', 'venue_id', 'collapsed_at,created_at,decisions,event_id,inherited_decisions,inherited_template_refs,overrides,profile_id,profile_name,updated_at,uses_profile,venue_id'),
      ('event_inventory', 'venue_id', 'created_at,event_id,finalized_at,id,status,template_id,updated_at,venue_id'),
      ('event_inventory_items', 'venue_id', 'added_to_event_order_at,category,created_at,event_inventory_id,id,inventory_item_id,is_included,name,notes,quantity,sort_order,unit_price,updated_at,venue_id'),
      ('event_orders', 'venue_id', 'client_id,created_at,event_id,finalized_at,id,revision,shared_at,status,template_id,updated_at,venue_id'),
      ('event_order_lines', 'venue_id', 'amount,created_at,description,description_detail,event_order_id,id,inventory_item_id,is_included,notes,offering_id,package_id,provenance,quantity,section_id,sort_order,unit,unit_price,updated_at,venue_id'),
      ('event_order_sections', 'venue_id', 'created_at,event_order_id,floor_plan_id,id,name,sort_order,updated_at,venue_id'),
      ('event_order_activities', 'venue_id', 'created_at,description,event_order_id,id,title,type,venue_id'),
      ('event_order_share_snapshots', 'venue_id', 'created_at,event_order_id,id,payload,revision,shared_at,venue_id'),
      ('event_order_templates', 'venue_id', 'created_at,description,id,is_archived,name,source_master_key,updated_at,venue_id'),
      ('event_order_template_groups', 'venue_id', 'allow_quantity,created_at,id,instructions,max_select,min_select,name,section_id,selection_mode,sort_order,template_id,updated_at,venue_id'),
      ('event_order_template_sections', 'venue_id', 'created_at,guidance,id,name,sort_order,template_id,updated_at,venue_id'),
      ('event_order_template_lines', 'venue_id', 'created_at,description,description_detail,id,included_by_default,offering_id,pricing_model,quantity,section_id,sort_order,template_id,unit,unit_price,updated_at,venue_id'),
      ('event_order_template_options', 'venue_id', 'created_at,description,group_id,id,is_default,is_included,label,offering_id,sort_order,template_id,unit_price,updated_at,venue_id'),
      ('packages', 'venue_id', 'base_price,category,created_at,description,eligible_event_types,eligible_space_ids,id,import_batch_id,is_active,max_guest_count,min_guest_count,name,offer_role,sort_order,source_master_key,updated_at,venue_id'),
      ('package_items', 'venue_id', 'created_at,description,id,package_id,quantity,sort_order,unit,venue_id'),
      ('offerings', 'venue_id', 'category_id,created_at,default_unit_price,description,id,inventory_item_id,is_archived,name,sort_order,unit,updated_at,venue_id'),
      ('offering_categories', 'venue_id', 'created_at,id,name,sort_order,updated_at,venue_id'),
      ('inventory_items', 'venue_id', 'available_for_floor_plans,category_id,color,created_at,height,id,image_url,import_batch_id,is_archived,length,name,printable_name,quantity_available,shape,updated_at,venue_id,width'),
      ('inventory_categories', 'venue_id', 'created_at,id,name,sort_order,source_master_key,updated_at,venue_id'),
      ('inventory_templates', 'venue_id', 'created_at,description,id,is_archived,name,source_master_key,updated_at,venue_id'),
      ('inventory_template_items', 'venue_id', 'category,created_at,id,inventory_item_id,is_included,name,notes,quantity,sort_order,template_id,unit_price,updated_at,venue_id'),
      ('contracts', 'venue_id', 'amends_contract_id,attention_notified_at,branding_snapshot,client_id,consent_confirmed,content,created_at,event_id,execution_origin,expires_at,id,is_couple_visible,sent_at,signed_at,signer_ip,signer_name,signer_user_agent,status,template_id,title,updated_at,venue_id'),
      ('contract_signers', 'venue_id', 'client_contact_id,consent_confirmed,consent_text,content_hash,contract_id,created_at,id,is_required,sign_order,signed_at,signer_email,signer_ip,signer_name,signer_ref_id,signer_role,signer_type,signer_user_agent,updated_at,venue_id'),
      ('contract_templates', 'venue_id', 'content,created_at,description,id,is_archived,is_default,name,source_master_key,updated_at,venue_id'),
      ('contract_activities', 'venue_id', 'actor_id,actor_label,contract_id,created_at,description,id,title,type,venue_id'),
      ('invoices', 'venue_id', 'amends_invoice_id,balance_due,branding_snapshot,client_id,created_at,discount_amount,display_name,due_date,event_id,event_order_dismissed_fingerprint,event_order_id,event_order_revision_at_freeze,id,invoice_number,is_couple_visible,issued_at,notes,quickbooks_invoice_id,quickbooks_sync_status,quickbooks_synced_at,status,subtotal,tax_amount,total,updated_at,venue_id'),
      ('invoice_line_items', 'venue_id', 'amount,created_at,description,discount_type,discount_value,event_order_line_id,id,invoice_id,package_id,quantity,revenue_category,sort_order,tax_rate_mode,tax_rate_value,type,unit_price,venue_id'),
      ('invoice_activities', 'venue_id', 'created_at,description,id,invoice_id,title,type,venue_id'),
      ('payment_schedules', 'venue_id', 'acknowledged_invoice_total,client_id,created_at,currency,event_id,id,invoice_id,notes,title,total_amount,updated_at,venue_id'),
      ('payment_line_items', 'venue_id', 'amount,created_at,due_date,id,label,notes,obligation_kind,paid_amount,paid_at,payment_method,quickbooks_payment_id,quickbooks_refund_id,quickbooks_refund_net_synced,quickbooks_sync_status,quickbooks_synced_at,reference_number,refund_reason,refunded_amount,refunded_at,schedule_id,sort_order,status,stripe_payment_method_type,updated_at,venue_id'),
      ('payment_activities', 'venue_id', 'created_at,description,id,schedule_id,title,type,venue_id'),
      ('venue_vendor_relationships', 'venue_id', 'added_at,added_by_user_id,display_order,id,is_in_house,is_required,notes,preference_level,promotion_details,promotion_headline,promotion_updated_at,special_pricing_note,status,updated_at,vendor_id,venue_id'),
      ('event_vendor_assignments', 'venue_id', 'agreed_fee,arrival_time,checked_in_at,client_id,created_at,event_id,id,internal_notes,load_in_notes,notes,payment_status,setup_complete_at,setup_location,share_couple_address,share_couple_email,share_couple_phone,vendor_id,venue_id'),
      ('event_vendor_recommendations', 'venue_id', 'created_at,event_id,id,note,picked_at,recommended_at,selected_at,source,vendor_id,venue_id'),
      ('vendor_inquiries', 'venue_id', 'contact_email,contact_name,created_at,event_date,event_type,event_vendor_assignment_id,follow_up_at,id,notes,source,status,updated_at,vendor_id,venue_id'),
      ('timeline_templates', 'venue_id', 'created_at,event_type,id,is_archived,is_default,name,source_master_key,space_id,updated_at,venue_id'),
      ('timeline_template_items', 'venue_id', 'audiences,created_at,day_offset,description,id,minutes_offset,needs_review,notes,sort_order,template_id,time_of_day,title,updated_at,venue_id'),
      ('timeline_sections', 'venue_id', 'client_can_add,client_id,created_at,event_id,id,name,sort_order,updated_at,venue_id'),
      ('timeline_entries', 'venue_id', 'assigned_to_staff_id,audiences,client_id,created_at,day_offset,description,end_time,entry_time,event_id,id,lock_state,notes,owner,section_id,sort_order,source_space_use_key,status,timing_attention,timing_clock_intent,timing_clock_overridden,timing_day_anchor,timing_day_intent,timing_day_offset_overridden,timing_fixed_date,timing_relative_day_offset,timing_relative_minutes,timing_template_day_anchor,timing_template_day_offset,title,updated_at,venue_id'),
      ('timeline_entry_links', 'venue_id', 'created_at,id,label,sort_order,timeline_entry_id,url,venue_id'),
      ('timeline_entry_attachments', 'venue_id', 'created_at,document_id,id,sort_order,timeline_entry_id,venue_id'),
      ('timeline_entry_context_links', 'venue_id', 'conversation_id,created_at,floor_plan_id,id,invoice_id,timeline_entry_id,vendor_assignment_id,venue_id'),
      ('event_tasks', 'venue_id', 'action_label,action_type,action_url,assigned_at,assigned_to_staff_id,auto_complete_trigger,category,client_id,completed_at,completed_by,created_at,days_offset,depends_on_event_task_id,description,due_date,due_date_locked,due_date_rule_kind,escalated_at,escalation_after_days,event_id,id,instructions,is_required,location,milestone_kind,milestone_name,notes,notify_on_assign,notify_on_complete,owner_type,payment_line_item_id,progress_state,reminder_before_days,request_id,scheduled_date,scheduled_end_time,scheduled_start_time,sort_order,source_id,source_type,status,template_task_id,title,updated_at,venue_id,visibility'),
      ('event_task_context_links', 'venue_id', 'conversation_message_id,created_at,document_id,event_task_id,id,link_label,link_url,timeline_entry_id,venue_id'),
      ('task_reminders', 'venue_id', 'after_due_recur_interval_days,contract_id,created_at,event_task_id,id,notify_role,payment_line_item_id,reminder_type,scheduled_for,sent_at,status,tour_appointment_id,venue_id'),
      ('playbook_templates', 'venue_id', 'created_at,description,event_type,id,is_archived,is_default,kind,name,source_master_key,updated_at,venue_id'),
      ('playbook_tasks', 'venue_id', 'action_label,action_type,action_url,auto_complete_trigger,category,created_at,days_offset,depends_on_task_id,description,due_date_rule_kind,escalation_after_days,id,instructions,is_required,milestone_id,needs_review,notify_on_assign,notify_on_complete,owner_type,reminder_before_days,reminder_interval_days,reminder_max_count,sort_order,template_id,title,venue_id,visibility'),
      ('playbook_milestones', 'venue_id', 'created_at,id,kind,name,sort_order,template_id,updated_at,venue_id'),
      ('playbook_task_attachments', 'venue_id', 'created_at,document_id,id,link_label,link_url,playbook_task_id,sort_order,venue_id'),
      ('event_playbook_applications', 'venue_id', 'applied_at,client_id,event_id,id,kind,released_at,template_id,template_name,venue_id'),
      ('questionnaire_templates', 'venue_id', 'created_at,custom_fields,description,field_order,id,included_fields,is_archived,kind,master_overrides,name,required_fields,source_master_key,updated_at,venue_id'),
      ('conversations', 'venue_id', 'assigned_staff_id,contact_unread,conversation_kind,created_at,event_vendor_assignment_id,id,inbox_owner_client_id,inbox_owner_kind,inbox_owner_lead_id,inquiry_context,last_message_at,needs_response,relationship_id,vendor_relationship_id,venue_id,venue_unread'),
      ('conversation_messages', 'venue_id', 'body,body_html,channel,channel_metadata,contact_read_at,conversation_id,failure_reason,id,provider_account_sid,provider_id,sender_id,sender_type,sent_at,status,venue_id,venue_read_at'),
      ('conversation_participants', 'venue_id', 'conversation_id,created_at,id,participant_id,participant_type,venue_id'),
      ('messages', 'venue_id', 'body,body_html,channel,created_at,delivered_at,direction,error_message,from_email,from_name,id,provider_id,sent_at,status,subject,thread_id,to_email,to_phone,updated_at,venue_id'),
      ('message_threads', 'venue_id', 'channel,client_id,created_at,event_id,id,last_message_at,lead_id,message_count,status,subject,updated_at,vendor_id,venue_id'),
      ('message_thread_participants', 'venue_id', 'added_at,added_by,can_reply,can_view,contact_id,id,is_cc,participant_type,receives_notifications,thread_id,venue_id'),
      ('message_events', 'venue_id', 'event_type,id,message_id,occurred_at,venue_id'),
      ('message_attachments', 'venue_id', 'created_at,file_size,id,message_id,mime_type,name,storage_path,storage_url,venue_id'),
      ('scheduled_messages', 'venue_id', 'body,channel,created_at,email_subject,error_message,id,merge_payment_line_item_id,merge_task_name,merge_tour_appointment_id,relationship_id,scheduled_for,sent_at,sequence_enrollment_id,sequence_step_id,status,template_id,updated_at,venue_id'),
      ('message_templates', 'venue_id', 'category,created_at,email_body,email_subject,id,is_archived,name,sms_body,source_master_key,updated_at,venue_id'),
      ('message_template_attachments', 'venue_id', 'created_at,document_id,id,link_label,link_url,sort_order,template_id,venue_id'),
      ('message_sequences', 'venue_id', 'created_at,id,name,source_master_key,status,trigger_stage,trigger_type,update_pipeline_on_enroll,updated_at,venue_id'),
      ('sequence_steps', 'venue_id', 'channel,created_at,id,offset_days,sequence_id,sort_order,template_id,venue_id'),
      ('sequence_enrollments', 'venue_id', 'created_at,enrolled_at,exited_at,id,paused_at,relationship_id,resumed_at,sequence_id,status,venue_id'),
      ('documents', 'venue_id', 'category,client_id,created_at,event_id,expires_at,file_name,file_size,id,is_couple_visible,lead_id,mime_type,name,notes,shared_with_vendors,source_library_document_id,storage_path,storage_url,tags,updated_at,uploaded_by_id,uploaded_by_type,vendor_id,venue_id'),
      ('document_file_versions', 'venue_id', 'created_at,document_id,file_name,file_size,id,mime_type,replaced_by,storage_path,storage_url,venue_id,version_number'),
      ('floor_plans', 'venue_id', 'background_document_id,background_image_opacity,background_image_url,background_locked,client_access,client_id,created_at,event_id,finalized_at,id,measurement_unit,name,notes,room_depth_ft,room_width_ft,shared_with_couple,shared_with_vendors,source_template_id,space_id,updated_at,venue_id'),
      ('floor_plan_objects', 'venue_id', 'capacity,color,created_at,display_shape,floor_plan_id,height,id,inventory_item_id,label,locked,notes,object_type,rotation,sort_order,updated_at,venue_id,width,x,y'),
      ('floor_plan_templates', 'venue_id', 'background_document_id,background_image_opacity,background_image_url,background_locked,created_at,event_type,id,is_archived,is_default,measurement_unit,name,room_depth_ft,room_width_ft,source_master_key,space_id,updated_at,venue_id'),
      ('floor_plan_template_objects', 'venue_id', 'capacity,color,created_at,display_shape,height,id,inventory_item_id,label,locked,notes,object_type,rotation,sort_order,template_id,updated_at,venue_id,width,x,y'),
      ('venue_staff', 'venue_id', 'accepted_at,access_title,capability_overrides,created_at,email,full_name,id,invited_at,invited_by,is_active,is_owner,last_active_at,owner_invite_pending,role,title,title_basis,user_id,venue_id'),
      ('quickbooks_connections', 'venue_id', 'company_name,connected_at,created_at,default_income_account_name,default_income_account_quickbooks_id,default_item_quickbooks_id,disconnected_at,environment,id,last_error,last_error_at,last_health_check_at,last_health_check_ok,realm_id,status,updated_at,venue_id'),
      ('facebook_connections', 'venue_id', 'connected_at,created_at,disconnected_at,id,last_error,last_error_at,last_health_check_at,last_health_check_ok,page_id,page_name,status,updated_at,venue_id'),
      ('venue_twilio_accounts', 'venue_id', 'a2p_brand_sid,a2p_brand_status,a2p_campaign_sid,a2p_campaign_status,a2p_trust_product_sid,compliance_submitted_at,created_at,default_from_e164,messaging_service_sid,phone_a2p_status,phone_number_sid,provisioning_generation,secondary_profile_sid,status,status_detail,twilio_account_sid,updated_at,venue_id')
    ) as t(table_name, scope_column, column_list)
  loop
    if spec.table_name = 'venues' then
      execute format(
        'select public.venue_export_project(to_jsonb(t), string_to_array(%L, '','')) from public.venues t where t.id = $1',
        spec.column_list
      )
        into chunk
        using p_venue_id;
      result := result || jsonb_build_object('venues', chunk);
    else
      execute format(
        'select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(t), string_to_array(%L, '',''))), ''[]''::jsonb) from public.%I t where t.%I = $1',
        spec.column_list,
        spec.table_name,
        spec.scope_column
      )
        into chunk
        using p_venue_id;
      result := result || jsonb_build_object(spec.table_name, chunk);
    end if;
  end loop;


  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(v), string_to_array('accepting_inquiries,availability_notes,average_rating,business_name,category,contact_name,cover_image_url,created_at,description,email,facebook_url,hero_image_url,id,import_batch_id,instagram_url,insurance_expiry,is_claimed,is_marketplace_listed,logo_url,phone,pinterest_url,pricing_tier,profile_slug,review_count,service_area,subscription_status,subscription_tier,tiktok_url,trial_ends_at,updated_at,website_url', ','))), '[]'::jsonb)
    from public.vendors v
    where v.id in (
      select r.vendor_id
      from public.venue_vendor_relationships r
      where r.venue_id = $1
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('vendors', chunk);

  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(a), string_to_array('created_at,file_name,file_size,file_url,id,message_id,mime_type', ','))), '[]'::jsonb)
    from public.conversation_message_attachments a
    join public.conversation_messages m on m.id = a.message_id
    where m.venue_id = $1
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('conversation_message_attachments', chunk);

  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(d), string_to_array('behavior,created_at,expires_at,id,name,notes,owner_id,owner_type,retention_policy,source,status,tags,type,updated_at', ','))), '[]'::jsonb)
    from public.canonical_documents d
    where (
      d.owner_type = 'venue' and d.owner_id = $1
    ) or (
      d.owner_type = 'event' and d.owner_id in (
        select e.id from public.events e where e.venue_id = $1
      )
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('canonical_documents', chunk);

  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(v), string_to_array('content,created_at,created_by_id,created_by_type,document_id,id,is_current,locked_at,sequence_number', ','))), '[]'::jsonb)
    from public.canonical_document_versions v
    join public.canonical_documents d on d.id = v.document_id
    where (
      d.owner_type = 'venue' and d.owner_id = $1
    ) or (
      d.owner_type = 'event' and d.owner_id in (
        select e.id from public.events e where e.venue_id = $1
      )
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('canonical_document_versions', chunk);

  execute $q$
    select coalesce(jsonb_agg(public.venue_export_project(to_jsonb(r), string_to_array('byte_size,checksum,created_at,generated_by_id,generated_by_type,id,mime_type,representation_type,storage_path,storage_provider,storage_url,version_id', ','))), '[]'::jsonb)
    from public.canonical_document_representations r
    join public.canonical_document_versions v on v.id = r.version_id
    join public.canonical_documents d on d.id = v.document_id
    where (
      d.owner_type = 'venue' and d.owner_id = $1
    ) or (
      d.owner_type = 'event' and d.owner_id in (
        select e.id from public.events e where e.venue_id = $1
      )
    )
  $q$
    into chunk
    using p_venue_id;
  result := result || jsonb_build_object('canonical_document_representations', chunk);

  result := jsonb_build_object('exportedAt', now()) || result;
  result := jsonb_set(result, '{contracts}', public.venue_export_shape_collection(result->'contracts', 'branding_snapshot', array['name','businessName','logoUrl','primaryColor','secondaryColor','accentColor','neutralColor','email','phone','website','addressLine1','addressLine2','city','stateRegion','postalCode','country']));
  result := jsonb_set(result, '{invoices}', public.venue_export_shape_collection(result->'invoices', 'branding_snapshot', array['name','businessName','logoUrl','primaryColor','secondaryColor','accentColor','neutralColor','email','phone','website','addressLine1','addressLine2','city','stateRegion','postalCode','country']));
  result := jsonb_set(result, '{conversation_messages}', public.venue_export_shape_collection(result->'conversation_messages', 'channel_metadata', array['sequenceEnrollmentId','sourceType','sourceId','automated']));
  result := jsonb_set(result, '{event_order_share_snapshots}', public.venue_export_shape_collection(result->'event_order_share_snapshots', 'payload', array['sections','lines','total']));
  result := jsonb_set(result, '{conversations}', public.venue_export_shape_collection(result->'conversations', 'inquiry_context', array['eventId','eventDate','eventType','venueName','coupleName']));
  return public.venue_export_redact(result);
end;
$$;



revoke all on function public.venue_export_key_blocked(text) from public, anon, authenticated;
revoke all on function public.venue_export_redact(jsonb) from public, anon, authenticated;
revoke all on function public.venue_export_shape_collection(jsonb, text, text[]) from public, anon, authenticated;

alter function public.get_venue_export(uuid) set statement_timeout = '30s';

notify pgrst, 'reload schema';

