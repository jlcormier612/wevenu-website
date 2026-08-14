-- Vendor task notification deep-links: use `focus=` (event page param) instead
-- of legacy `taskId=`. Also include focus on new_task alerts. Backfill inbox
-- rows so existing "Couple completed a task" notifications deep-link correctly.

-- ── 1. Backfill stored links ──────────────────────────────────────────────────

update public.vendor_notifications
set link = replace(link, 'taskId=', 'focus=')
where link like '%taskId=%';

-- ── 2. task_completed from couple portal ──────────────────────────────────────

create or replace function public.complete_portal_vendor_task(
  p_token   text,
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids            record;
  v_session        public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_task           public.vendor_tasks%rowtype;
  v_assignment_id  uuid;
  v_vendor_name    text;
begin
  select * into v_ids from public._resolve_portal_ids(p_token);
  if v_ids.client_id is null or v_ids.event_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  if v_session.access_level in ('view_only', 'financial') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  v_effective_role := v_session.access_level;
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  end if;

  if v_effective_role not in ('full_access', 'planning', 'couple') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  select * into v_task
  from public.vendor_tasks
  where id = p_task_id
    and event_id = v_ids.event_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if v_task.couple_visibility is distinct from 'owned' then
    return jsonb_build_object('ok', false, 'error', 'not_owned');
  end if;

  if v_task.status = 'complete' then
    return jsonb_build_object('ok', true, 'alreadyComplete', true);
  end if;

  select eva.id into v_assignment_id
  from public.event_vendor_assignments eva
  where eva.event_id = v_task.event_id
    and eva.vendor_id = v_task.vendor_id
  limit 1;

  if v_assignment_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_assignment');
  end if;

  update public.vendor_tasks
  set
    status = 'complete',
    completed_at = now(),
    completed_by = 'couple'
  where id = v_task.id;

  select coalesce(nullif(trim(business_name), ''), 'Vendor')
  into v_vendor_name
  from public.vendors
  where id = v_task.vendor_id;

  perform public.create_vendor_notification(
    v_task.vendor_id,
    v_task.event_id,
    v_assignment_id,
    'task_completed',
    'Couple completed a task',
    left(v_task.title, 160),
    '/vendor/events/' || v_assignment_id::text || '?tab=tasks&focus=' || v_task.id::text,
    '✅'
  );

  return jsonb_build_object('ok', true, 'vendorName', v_vendor_name);
exception when others then
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

grant execute on function public.complete_portal_vendor_task(text, uuid) to anon, authenticated;

-- ── 3. new_task alerts — deep-link to the specific task ───────────────────────

create or replace function public._trigger_vendor_task_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if NEW.visibility not in ('vendor_visible', 'vendor_owned') then
    return NEW;
  end if;

  -- Only when newly visible to vendors (insert or visibility transition).
  if TG_OP = 'UPDATE'
     and OLD.visibility in ('vendor_visible', 'vendor_owned') then
    return NEW;
  end if;

  for r in
    select eva.id as assignment_id, eva.vendor_id
    from public.event_vendor_assignments eva
    where eva.event_id = NEW.event_id
  loop
    perform public.create_vendor_notification(
      r.vendor_id,
      NEW.event_id,
      r.assignment_id,
      'new_task',
      'New task shared with you',
      NEW.title,
      '/vendor/events/' || r.assignment_id::text || '?tab=tasks&focus=' || NEW.id::text,
      '✅'
    );
  end loop;

  return NEW;
exception when others then
  raise warning '_trigger_vendor_task_notification failed for task %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;

notify pgrst, 'reload schema';
