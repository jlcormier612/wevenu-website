-- Sprint 80: Expose phase and days_offset on portal tasks.
-- Couples need phase to know which tasks are "Final Details" vs "Wedding Day"
-- so the portal can switch into the right mode at the right time.

create or replace function public.get_portal_tasks(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       public.client_portal_sessions%rowtype;
  v_effective_role text;
  v_event         record;
  v_tasks         jsonb;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Effective role: contact's portal_role overrides session access_level
  if v_session.contact_id is not null then
    select portal_role into v_effective_role
    from public.client_contacts
    where id = v_session.contact_id;
    v_effective_role := coalesce(v_effective_role, v_session.access_level);
  else
    v_effective_role := v_session.access_level;
  end if;

  -- Financial-only contacts cannot see planning tasks
  if v_effective_role = 'financial' or v_effective_role = 'reminders_only' then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select id, event_date into v_event
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
    and status not in ('cancelled')
  order by event_date asc limit 1;

  if not found then
    return jsonb_build_object('tasks', '[]'::jsonb);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',          t.id,
      'title',       t.title,
      'description', t.description,
      'category',    t.category,
      'ownerType',   t.owner_type,
      'visibility',  t.visibility,
      'dueDate',     t.due_date,
      'daysOffset',  t.days_offset,
      'phase',       coalesce(t.phase, case
                       when t.days_offset > 0         then 'post_wedding'
                       when t.days_offset = 0         then 'wedding_day'
                       when t.days_offset >= -14      then 'final_details'
                       else                                'planning'
                     end),
      'status',      t.status,
      'isRequired',  t.is_required,
      'completedAt', t.completed_at,
      -- view_only contacts can see but not complete tasks
      'canComplete', t.visibility = 'client_owned'
                     and t.status not in ('complete', 'waived', 'blocked')
                     and v_effective_role in ('full_access', 'planning', 'couple')
    )
    order by t.due_date asc, t.sort_order asc
  )
  into v_tasks
  from public.event_tasks t
  where t.event_id  = v_event.id
    and t.venue_id  = v_session.venue_id
    and t.visibility in ('client_visible', 'client_owned')
    and t.status   != 'waived';

  return jsonb_build_object('tasks', coalesce(v_tasks, '[]'::jsonb));
end;
$$;

notify pgrst, 'reload schema';
