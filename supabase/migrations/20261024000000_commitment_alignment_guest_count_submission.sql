-- ============================================================================
-- Commitment Alignment Sprint — Guest List Submission
--
-- docs/commitment-lifecycle-architecture.md §9 Domain Mapping Matrix: Guest
-- List's required adjustment was "a real 'Finalize Guest Count' Submit
-- action (a Task) that sets events.guest_count as a Commitment, replacing
-- today's independently-editable column." This closes the gap named there
-- and in docs/booking-financial-architecture-final-release-assessment.md
-- Finding 1 (guest count triplication/drift): events.guest_count remains
-- coordinator-editable (Event is venue-owned per docs/domain-model.md — no
-- regression there), but a couple's explicit submission is now a real,
-- attributable Commitment, not a second silent writer.
--
-- guest_count_submissions is append-only (Never Silently Change an
-- Agreement) — every submission is a permanent row; events.guest_count
-- always reflects whichever write (coordinator edit or couple submission)
-- happened most recently, per the Ownership triad's Operational Owner
-- relationship (§4 of the architecture doc: Venue is Operational Owner,
-- and Event itself is venue-owned "on behalf of the Client").
--
-- Private Until Committed: the couple's live, private guest list/RSVP view
-- is unchanged (already correctly Client-Owned, no venue visibility beyond
-- this explicit submission) — nothing here grants the venue any new
-- continuous visibility into couple_guests itself.
-- ============================================================================

create table public.guest_count_submissions (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  venue_id          uuid not null references public.venues(id) on delete cascade,
  event_id          uuid not null references public.events(id) on delete cascade,
  submitted_count   integer not null check (submitted_count >= 0),
  note              text,
  created_at        timestamptz not null default now()
);

create index guest_count_submissions_event on public.guest_count_submissions (event_id, created_at desc);

alter table public.guest_count_submissions enable row level security;

create policy guest_count_submissions_venue_select
  on public.guest_count_submissions for select
  using (venue_id = current_user_venue_id());

grant select on public.guest_count_submissions to authenticated;

-- submit_guest_count: the couple's Commitment action ("Finalize Guest
-- Count" task) — portal-token authenticated, mirrors the SECURITY DEFINER
-- pattern used throughout the Client Workspace/Hosted Experience work so
-- session resolution never depends on RLS granting a table SELECT to an
-- anonymous request (the bug found in app/api/portal/invite this session).
-- Auto-completes any matching Playbook task natively in SQL, rather than
-- via the TS-level triggerAutoComplete helper, which was found to depend
-- on which Supabase client instance the caller happens to pass it (some
-- call sites pass an admin/service-role client, some don't) — this RPC
-- avoids that inconsistency entirely by doing the update itself.
create or replace function public.submit_guest_count(p_token text, p_count integer, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.client_portal_sessions%rowtype;
  v_event     public.events%rowtype;
  v_submission_id uuid;
  v_completed_task_id uuid;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;

  if p_count is null or p_count < 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_count');
  end if;

  select * into v_event
  from public.events
  where client_id = v_session.client_id and venue_id = v_session.venue_id
    and status not in ('cancelled', 'complete')
  order by event_date asc limit 1;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  insert into public.guest_count_submissions (client_id, venue_id, event_id, submitted_count, note)
  values (v_session.client_id, v_session.venue_id, v_event.id, p_count, nullif(trim(p_note), ''))
  returning id into v_submission_id;

  update public.events
  set guest_count = p_count, updated_at = now()
  where id = v_event.id;

  -- Auto-complete the matching Playbook task (Never Silently Change an
  -- Agreement — this is the Commitment Lifecycle's Submit event; the task
  -- completion IS the act of sharing, per the architecture doc §2/§8).
  for v_completed_task_id in
    update public.event_tasks
    set status = 'complete', completed_at = now(), completed_by = 'system'
    where venue_id = v_session.venue_id and event_id = v_event.id
      and auto_complete_trigger = 'guest_count_finalized'
      and status in ('pending', 'blocked', 'overdue')
    returning id
  loop
    update public.event_tasks
    set status = 'pending'
    where depends_on_event_task_id = v_completed_task_id
      and status = 'blocked' and venue_id = v_session.venue_id;
  end loop;

  return jsonb_build_object('ok', true, 'submissionId', v_submission_id, 'count', p_count);
end;
$$;

grant execute on function public.submit_guest_count(text, integer, text) to anon, authenticated;

-- get_guest_count_status: portal-side read — the live, currently-computed
-- attending count (a suggestion, not a commitment) alongside the
-- submission history, so the couple can see what they last submitted and
-- when without that history ever being confused with their live draft.
create or replace function public.get_guest_count_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_event   public.events%rowtype;
  v_live_count integer;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('error', 'invalid_token'); end if;

  select * into v_event
  from public.events
  where client_id = v_session.client_id and venue_id = v_session.venue_id
    and status not in ('cancelled', 'complete')
  order by event_date asc limit 1;

  select count(*) filter (where rsvp_status = 'attending')
       + count(*) filter (where rsvp_status = 'attending' and plus_one = true)
  into v_live_count
  from public.couple_guests
  where client_id = v_session.client_id and venue_id = v_session.venue_id;

  return jsonb_build_object(
    'liveSuggestedCount', coalesce(v_live_count, 0),
    'currentEventGuestCount', v_event.guest_count,
    'lastSubmission', (
      select jsonb_build_object('count', s.submitted_count, 'note', s.note, 'submittedAt', s.created_at)
      from public.guest_count_submissions s
      where s.client_id = v_session.client_id and s.venue_id = v_session.venue_id
      order by s.created_at desc limit 1
    )
  );
end;
$$;

grant execute on function public.get_guest_count_status(text) to anon, authenticated;

-- Coordinator-facing read — latest submission per event, for the Event
-- detail page's "Submitted by couple · [date]" indicator, distinct from a
-- coordinator's own manually-entered estimate.
create or replace function public.get_latest_guest_count_submission(p_venue_id uuid, p_event_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select jsonb_build_object('count', s.submitted_count, 'submittedAt', s.created_at)
  from public.guest_count_submissions s
  where s.venue_id = p_venue_id and s.event_id = p_event_id
  order by s.created_at desc limit 1;
$$;

grant execute on function public.get_latest_guest_count_submission(uuid, uuid) to authenticated;
