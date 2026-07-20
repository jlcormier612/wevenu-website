-- ============================================================================
-- Timeline Implementation — Submission (Copy at Commitment)
-- docs/client-workspace-product-architecture.md §12, refined 2026-07-17:
-- submitting creates an immutable operational snapshot for the venue; it
-- does NOT freeze the client's own workspace — they keep editing freely,
-- and a later submit creates a new snapshot. The venue always reads the
-- latest snapshot, never the client's live draft. Mirrors
-- experience_versions' shape exactly, per your own instruction.
-- ============================================================================

create table public.timeline_submissions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  venue_id    uuid not null references public.venues(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  snapshot    jsonb not null,
  entry_count integer not null default 0,
  created_at  timestamptz not null default now()
);

create index timeline_submissions_event on public.timeline_submissions (event_id, created_at desc);

alter table public.timeline_submissions enable row level security;

create policy timeline_submissions_venue_select
  on public.timeline_submissions for select
  using (venue_id = current_user_venue_id());

grant select on public.timeline_submissions to authenticated;

-- ── submit_timeline — the couple's whole-timeline Submit action ─────────────
-- Snapshots every current owner='client' entry, regardless of its own
-- Visibility tags — submission and publication are independent axes (§6),
-- so what reaches the venue here has nothing to do with what's currently
-- guest/wedding_party/vendor-visible.
create or replace function public.submit_timeline(p_access_token text, p_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_session_venue_id  uuid;
  v_event_id          uuid;
  v_snapshot          jsonb;
  v_count             integer;
  v_submission_id     uuid;
  v_completed_task_id uuid;
begin
  select s.venue_id into v_session_venue_id
  from public.client_portal_sessions s
  where s.access_token = p_access_token and (s.expires_at is null or s.expires_at > now());
  if v_session_venue_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.venue_id = v_session_venue_id) then
    return jsonb_build_object('ok', false, 'error', 'unauthorized');
  end if;

  select e.id into v_event_id
  from public.events e
  where e.client_id = p_client_id and e.venue_id = v_session_venue_id
  order by e.event_date asc limit 1;
  if v_event_id is null then return jsonb_build_object('ok', false, 'error', 'event_not_found'); end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', te.id, 'title', te.title, 'description', te.description,
      'entryTime', te.entry_time, 'sectionId', te.section_id,
      'sortOrder', te.sort_order, 'audiences', te.audiences
    ) order by te.entry_time asc nulls last, te.sort_order, te.created_at), '[]'::jsonb),
    count(*)
  into v_snapshot, v_count
  from public.timeline_entries te
  where te.event_id = v_event_id and te.venue_id = v_session_venue_id and te.owner = 'client';

  insert into public.timeline_submissions (client_id, venue_id, event_id, snapshot, entry_count)
  values (p_client_id, v_session_venue_id, v_event_id, v_snapshot, v_count)
  returning id into v_submission_id;

  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session_venue_id and event_id = v_event_id
      and auto_complete_trigger = 'timeline_submitted'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id and status = 'blocked' and venue_id = v_session_venue_id;
  end loop;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'entryCount', v_count, 'submittedAt', now());
end $$;

grant execute on function public.submit_timeline(text, uuid) to anon, authenticated;
