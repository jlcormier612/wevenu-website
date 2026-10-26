-- Merge Lead: cast UUID FK patch values (planned_event_space_id, assigned_staff_id).
-- jsonb ->> yields text; assigning to uuid columns without ::uuid fails with:
--   column "assigned_staff_id" is of type uuid but expression is of type text
-- Same pattern as date columns already using $1::date.

create or replace function public.merge_leads_v1(
  p_venue_id uuid,
  p_primary_id uuid,
  p_secondary_id uuid,
  p_primary_updated_at timestamptz,
  p_secondary_updated_at timestamptz,
  p_field_patch jsonb,
  p_tour_cancel_ids uuid[],
  p_audit jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_primary public.leads%rowtype;
  v_secondary public.leads%rowtype;
  v_protection int;
  v_key text;
  v_val text;
  v_preserve_inquiry boolean;
  v_secondary_inquiry text;
  v_desc text;
  v_allowed text[] := array[
    'first_name','last_name','email','phone',
    'partner_first_name','partner_last_name','partner_email',
    'event_type','event_date','end_date','guest_count','estimated_budget',
    'inquiry_message','next_action_text','next_action_due','follow_up_date',
    'planned_event_space_id','assigned_staff_id','source',
    'preferred_communication_channels'
  ];
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  if p_primary_id is null or p_secondary_id is null or p_primary_id = p_secondary_id then
    return jsonb_build_object('ok', false, 'error', 'invalid_ids');
  end if;

  if not exists (
    select 1 from public.venue_staff vs
    where vs.venue_id = p_venue_id
      and vs.user_id = v_uid
      and vs.is_active = true
  ) and not exists (
    select 1 from public.venues v
    where v.id = p_venue_id and v.owner_user_id = v_uid
  ) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select * into v_primary
  from public.leads
  where id = p_primary_id and venue_id = p_venue_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'primary_not_found');
  end if;

  select * into v_secondary
  from public.leads
  where id = p_secondary_id and venue_id = p_venue_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'secondary_not_found');
  end if;

  if v_secondary.merged_into_lead_id = p_primary_id then
    return jsonb_build_object('ok', true, 'alreadyMerged', true, 'primaryId', p_primary_id, 'secondaryId', p_secondary_id);
  end if;

  if v_secondary.merged_into_lead_id is not null then
    return jsonb_build_object('ok', false, 'error', 'secondary_already_merged', 'mergedInto', v_secondary.merged_into_lead_id);
  end if;

  if v_primary.merged_into_lead_id is not null then
    return jsonb_build_object('ok', false, 'error', 'primary_is_merged', 'mergedInto', v_primary.merged_into_lead_id);
  end if;

  if v_primary.updated_at is distinct from p_primary_updated_at
     or v_secondary.updated_at is distinct from p_secondary_updated_at then
    return jsonb_build_object('ok', false, 'error', 'stale');
  end if;

  select count(*)::int into v_protection
  from public.tour_protection_requests
  where venue_id = p_venue_id
    and lead_id in (p_primary_id, p_secondary_id);
  if v_protection > 0 then
    return jsonb_build_object('ok', false, 'error', 'tour_protection', 'count', v_protection);
  end if;

  if p_field_patch is not null and p_field_patch <> '{}'::jsonb then
    for v_key in select jsonb_object_keys(p_field_patch)
    loop
      if not (v_key = any (v_allowed)) then
        continue;
      end if;
      if v_key = 'preferred_communication_channels' then
        update public.leads
        set preferred_communication_channels = coalesce(
              (select array_agg(x) from jsonb_array_elements_text(p_field_patch -> v_key) as t(x)),
              preferred_communication_channels
            ),
            updated_at = now()
        where id = p_primary_id;
      elsif v_key in ('guest_count') then
        update public.leads
        set guest_count = nullif(p_field_patch ->> v_key, '')::integer,
            updated_at = now()
        where id = p_primary_id;
      elsif v_key in ('estimated_budget') then
        update public.leads
        set estimated_budget = nullif(p_field_patch ->> v_key, '')::numeric,
            updated_at = now()
        where id = p_primary_id;
      elsif v_key in ('event_date', 'end_date', 'next_action_due', 'follow_up_date') then
        execute format(
          'update public.leads set %I = $1::date, updated_at = now() where id = $2',
          v_key
        ) using nullif(p_field_patch ->> v_key, ''), p_primary_id;
      elsif v_key in ('planned_event_space_id', 'assigned_staff_id') then
        -- jsonb text → uuid (required; bare text bind fails on uuid columns)
        execute format(
          'update public.leads set %I = $1::uuid, updated_at = now() where id = $2',
          v_key
        ) using nullif(p_field_patch ->> v_key, ''), p_primary_id;
      else
        v_val := p_field_patch ->> v_key;
        execute format(
          'update public.leads set %I = $1, updated_at = now() where id = $2',
          v_key
        ) using nullif(v_val, ''), p_primary_id;
      end if;
    end loop;
  end if;

  if p_tour_cancel_ids is not null and cardinality(p_tour_cancel_ids) > 0 then
    update public.tour_appointments
    set status = 'cancelled',
        cancellation_reason = coalesce(cancellation_reason, 'Merged lead — venue cancelled duplicate tour'),
        updated_at = now()
    where venue_id = p_venue_id
      and id = any (p_tour_cancel_ids)
      and lead_id in (p_primary_id, p_secondary_id)
      and status in ('scheduled', 'confirmed');

    update public.task_reminders
    set status = 'cancelled'
    where status = 'pending'
      and tour_appointment_id = any (p_tour_cancel_ids);
  end if;

  update public.tour_appointments
  set lead_id = p_primary_id, updated_at = now()
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.lead_notes
  set lead_id = p_primary_id, updated_at = now()
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.lead_tasks
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.lead_activities
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.documents
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.date_holds
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.lead_event_space_preferences
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.clients
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.commercial_selections
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.commercial_proposals
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.lifecycle_booking_events
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.message_threads
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.sms_consent_email_tokens
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.calendar_blocks
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.lead_intake_attempts
  set lead_id = p_primary_id
  where venue_id = p_venue_id and lead_id = p_secondary_id;

  update public.leads
  set merged_into_lead_id = p_primary_id,
      merged_at = now(),
      merged_by = v_uid,
      updated_at = now()
  where id = p_secondary_id and venue_id = p_venue_id;

  update public.lead_duplicate_reviews
  set status = 'merged',
      resolved_at = now()
  where venue_id = p_venue_id
    and status = 'needs_review'
    and (
      (lead_id = p_secondary_id and matched_lead_id = p_primary_id)
      or (lead_id = p_primary_id and matched_lead_id = p_secondary_id)
      or lead_id = p_secondary_id
      or matched_lead_id = p_secondary_id
    );

  -- Preserve secondary inquiry as its own history entry when the venue chose Keep both.
  v_preserve_inquiry := coalesce((p_audit->>'preserveSecondaryInquiry')::boolean, false);
  v_secondary_inquiry := nullif(trim(coalesce(v_secondary.inquiry_message, '')), '');
  if v_preserve_inquiry and v_secondary_inquiry is not null then
    v_desc := format(
      E'From merged lead %s (submitted %s%s).\n\n%s',
      p_secondary_id,
      to_char(v_secondary.created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'),
      case
        when nullif(trim(coalesce(v_secondary.source, '')), '') is not null
          then format(', source: %s', trim(v_secondary.source))
        else ''
      end,
      v_secondary_inquiry
    );
    if not exists (
      select 1
      from public.lead_activities la
      where la.venue_id = p_venue_id
        and la.lead_id = p_primary_id
        and la.type = 'additional_inquiry_message'
        and la.description like '%' || p_secondary_id::text || '%'
    ) then
      insert into public.lead_activities (venue_id, lead_id, type, title, description)
      values (
        p_venue_id,
        p_primary_id,
        'additional_inquiry_message',
        'Additional inquiry from merged lead',
        left(v_desc, 8000)
      );
    end if;
  end if;

  insert into public.lead_activities (venue_id, lead_id, type, title, description)
  values (
    p_venue_id,
    p_primary_id,
    'lead_merged',
    'Lead merged',
    format(
      'Merged duplicate lead %s into this lead. Audit: %s',
      p_secondary_id,
      left(coalesce(p_audit::text, '{}'), 1800)
    )
  );

  insert into public.lead_activities (venue_id, lead_id, type, title, description)
  values (
    p_venue_id,
    p_secondary_id,
    'lead_merged_away',
    'Merged into another lead',
    format('This lead was merged into %s.', p_primary_id)
  );

  return jsonb_build_object(
    'ok', true,
    'alreadyMerged', false,
    'primaryId', p_primary_id,
    'secondaryId', p_secondary_id
  );
end;
$$;

grant execute on function public.merge_leads_v1(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, uuid[], jsonb
) to authenticated;

notify pgrst, 'reload schema';
