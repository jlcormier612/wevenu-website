-- Sprint 80: Task Phases — Final Details, Wedding Day, Post-Wedding
--
-- Adds a `phase` column to playbook_tasks and event_tasks so tasks can be
-- explicitly tagged to a lifecycle stage. This unlocks phase-grouped UI,
-- the Wedding Day command center, and the Final Details playbook concept.
--
-- Phase values:
--   planning       — long-range planning (most tasks; > 14 days out)
--   final_details  — 2–4 weeks out checklist (floor plan, vendor confirms, walkthrough)
--   wedding_day    — day-of run-of-show operations (daysOffset = 0)
--   post_wedding   — follow-up tasks (thank-you, reviews, gallery delivery)
--
-- Backfill heuristic: derive from days_offset so existing data gains phases.

alter table public.playbook_tasks
  add column if not exists phase text
  check (phase in ('planning', 'final_details', 'wedding_day', 'post_wedding'));

alter table public.event_tasks
  add column if not exists phase text
  check (phase in ('planning', 'final_details', 'wedding_day', 'post_wedding'));

-- Backfill playbook_tasks
update public.playbook_tasks
set phase = case
  when days_offset > 0         then 'post_wedding'
  when days_offset = 0         then 'wedding_day'
  when days_offset >= -14      then 'final_details'
  else                              'planning'
end
where phase is null;

-- Backfill event_tasks
update public.event_tasks
set phase = case
  when days_offset > 0         then 'post_wedding'
  when days_offset = 0         then 'wedding_day'
  when days_offset >= -14      then 'final_details'
  else                              'planning'
end
where phase is null;

-- Also expose timeline_entries to the portal via a security-definer RPC.
-- Couples can see their day-of timeline (the run of show) without needing
-- venue-owner auth.

create or replace function public.get_portal_run_of_show(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_event_id uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_session.id is null then
    return jsonb_build_object('error', 'invalid_token');
  end if;

  -- Find the event linked to this client
  select id into v_event_id
  from public.events
  where client_id = v_session.client_id
    and venue_id  = v_session.venue_id
  order by event_date asc
  limit 1;

  if v_event_id is null then
    return jsonb_build_object('entries', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'entries', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          te.id,
            'title',       te.title,
            'description', te.description,
            'entryTime',   te.entry_time,
            'sortOrder',   te.sort_order
          )
          order by te.entry_time asc nulls last, te.sort_order, te.created_at
        ),
        '[]'::jsonb
      )
      from public.timeline_entries te
      where te.event_id = v_event_id
        and te.venue_id = v_session.venue_id
    )
  );
end;
$$;

grant execute on function public.get_portal_run_of_show(text) to anon, authenticated;

notify pgrst, 'reload schema';
