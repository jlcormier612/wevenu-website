-- ============================================================================
-- Sprint 51: Couple Engagement Signals
--
-- 1. couple_portal_events — activity signals from the couple's portal.
--    Feeds Luv's Couple Engagement dimension:
--    portal_visited | guests_added | guest_count_updated | todo_completed |
--    todo_added | rsvp_updated | csv_imported
--
-- 2. visibility_to_venue columns on couple_guests and couple_todos.
--    Default: false — couple-owned data is PRIVATE by default.
--    The couple controls what the venue can see, not the other way around.
--    "Private spaces. Shared workflows."
-- ============================================================================

-- ── 1. Couple portal activity signals ────────────────────────────────────────

create table public.couple_portal_events (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  session_id   uuid references public.client_portal_sessions(id) on delete set null,

  -- What happened
  event_type   text not null,   -- portal_visited | guests_added | todo_completed | etc.
  event_data   jsonb,           -- { count: 3 } for guests_added, { title: "…" } for todo

  occurred_at  timestamptz not null default now()
);

create index couple_portal_events_client
  on public.couple_portal_events (client_id, occurred_at desc);
create index couple_portal_events_venue_recent
  on public.couple_portal_events (venue_id, occurred_at desc);

-- RLS: venue owner can read for Luv observations; couple writes via SECURITY DEFINER
alter table public.couple_portal_events enable row level security;

create policy "venue owner reads couple portal events"
  on public.couple_portal_events for select
  using (exists (
    select 1 from public.venues
    where id = couple_portal_events.venue_id
      and owner_user_id = auth.uid()
  ));

grant select on public.couple_portal_events to authenticated;

-- SECURITY DEFINER: log a portal activity event (called from portal API routes)
create or replace function public.log_couple_event(
  p_token    text,
  p_type     text,
  p_data     jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_session public.client_portal_sessions%rowtype;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return; end if;

  insert into public.couple_portal_events (venue_id, client_id, session_id, event_type, event_data)
  values (v_session.venue_id, v_session.client_id, v_session.id, p_type, p_data);
end;
$$;

grant execute on function public.log_couple_event(text, text, jsonb) to anon, authenticated;

-- ── 2. Selective sharing columns (private by default) ────────────────────────
-- Couples can choose to share specific data with the venue.
-- The coordinator NEVER has default access to couple-owned data.

alter table public.couple_guests
  add column visibility_to_venue boolean not null default false;

alter table public.couple_todos
  add column visibility_to_venue boolean not null default false;

-- Coordinator view: only sees guests/todos the couple has explicitly shared
create or replace view public.shared_couple_guests as
  select g.*, c.first_name as client_first_name, c.last_name as client_last_name
  from public.couple_guests g
  join public.clients c on c.id = g.client_id
  where g.visibility_to_venue = true;

-- RLS on the view uses the underlying table's policies (already restricted)

-- Also update CSV batch-add function (used in Sprint 51 CSV import feature)
create or replace function public.batch_add_couple_guests(
  p_token  text,
  p_guests jsonb  -- array of { firstName, lastName, email, groupLabel }
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.client_portal_sessions%rowtype;
  v_guest   jsonb;
  v_count   integer := 0;
begin
  select * into v_session
  from public.client_portal_sessions
  where access_token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  if v_session.access_level in ('financial', 'reminders_only') then
    return jsonb_build_object('ok', false, 'error', 'insufficient_access');
  end if;

  for v_guest in select * from jsonb_array_elements(p_guests)
  loop
    insert into public.couple_guests (venue_id, client_id, first_name, last_name, email, group_label)
    values (
      v_session.venue_id,
      v_session.client_id,
      trim(v_guest->>'firstName'),
      nullif(trim(coalesce(v_guest->>'lastName', '')), ''),
      nullif(trim(coalesce(v_guest->>'email', '')), ''),
      nullif(trim(coalesce(v_guest->>'groupLabel', '')), '')
    );
    v_count := v_count + 1;
  end loop;

  -- Log the activity
  insert into public.couple_portal_events (venue_id, client_id, session_id, event_type, event_data)
  values (v_session.venue_id, v_session.client_id, v_session.id,
          'csv_imported', jsonb_build_object('count', v_count));

  return jsonb_build_object('ok', true, 'imported', v_count);
end;
$$;

grant execute on function public.batch_add_couple_guests(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
