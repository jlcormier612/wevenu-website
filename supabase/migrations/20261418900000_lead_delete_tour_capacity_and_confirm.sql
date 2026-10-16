-- Lead hard-delete left occupying tours archived-but-still-scheduled.
-- Capacity still counted them; confirm_token could still flip them to confirmed
-- with lead_id already SET NULL — confirmation never appeared on a surviving lead.
--
-- 1) Heal existing orphans (archived + occupying + null lead_id).
-- 2) Harden public confirm RPCs so archived tours cannot confirm.
-- Application applyLeadRecordDeletion cancels occupying tours before archive.

-- ── Heal orphaned capacity blockers ──────────────────────────────────────────

update public.tour_appointments
set status = 'cancelled',
    updated_at = now()
where is_archived = true
  and lead_id is null
  and status in ('scheduled', 'confirmed');

update public.task_reminders tr
set status = 'cancelled'
where tr.status = 'pending'
  and tr.tour_appointment_id in (
    select ta.id
    from public.tour_appointments ta
    where ta.is_archived = true
      and ta.lead_id is null
      and ta.status = 'cancelled'
  );

-- ── Public confirm: reject archived tours ────────────────────────────────────

create or replace function public.get_tour_by_confirm_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select ta.status, ta.scheduled_at, ta.duration_minutes, ta.contact_name,
         ta.is_archived,
         v.name as venue_name, v.primary_color, v.logo_url, v.timezone
  into v_row
  from public.tour_appointments ta
  join public.venues v on v.id = ta.venue_id
  where ta.confirm_token = p_token;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Archived tours are not confirmable (lead deleted / list hygiene). Surface
  -- as non-scheduled so the public page shows the safe unavailable message
  -- rather than a Confirm button that cannot succeed.
  if v_row.is_archived and v_row.status = 'scheduled' then
    v_row.status := 'cancelled';
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_row.status,
    'scheduledAt', v_row.scheduled_at,
    'durationMinutes', v_row.duration_minutes,
    'contactName', v_row.contact_name,
    'venueName', v_row.venue_name,
    'primaryColor', coalesce(v_row.primary_color, '#5D6F5D'),
    'logoUrl', v_row.logo_url,
    'timezone', v_row.timezone
  );
end;
$$;

grant execute on function public.get_tour_by_confirm_token(uuid) to anon, authenticated;

create or replace function public.confirm_tour_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appt record;
begin
  select id, venue_id, lead_id, contact_name, status, is_archived
  into v_appt
  from public.tour_appointments
  where confirm_token = p_token
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_appt.is_archived then
    return jsonb_build_object('ok', false, 'error', 'not_confirmable');
  end if;

  if v_appt.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true);
  end if;

  if v_appt.status <> 'scheduled' then
    return jsonb_build_object('ok', false, 'error', 'not_confirmable');
  end if;

  update public.tour_appointments
  set status = 'confirmed',
      confirmed_at = now(),
      confirmation_source = 'prospect_link',
      updated_at = now()
  where id = v_appt.id;

  if v_appt.lead_id is not null then
    insert into public.lead_activities (venue_id, lead_id, type, title, description)
    values (
      v_appt.venue_id, v_appt.lead_id, 'tour_confirmed', 'Tour confirmed',
      coalesce(v_appt.contact_name, 'The prospect') || ' confirmed their tour online.'
    );
  end if;

  return jsonb_build_object('ok', true, 'alreadyConfirmed', false);
end;
$$;

grant execute on function public.confirm_tour_by_token(uuid) to anon, authenticated;
