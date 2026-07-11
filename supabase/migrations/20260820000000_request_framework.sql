-- ============================================================================
-- Request Framework Foundation
--
-- A Request is a reusable platform capability: the venue asking the client
-- for something (a document, an approval, information, a selection, an
-- upload, a confirmation, a task) and tracking its lifecycle. It is not
-- specific to any feature — Planning, Documents, Contracts, Guest
-- Management, Floor Plans, Timeline, Website, and Budget will all reuse this
-- same table later by referencing a request, not by copying its shape.
--
-- Scope discipline for this migration:
--   - No feature-specific columns, statuses, or types.
--   - No feature integration — nothing references public.requests yet.
--   - No notification delivery — only a lifecycle event log future
--     notification systems can read (see get_request_lifecycle_events RPC
--     and the emitRequestLifecycleEvent hook in lib/requests).
-- ============================================================================

create table public.requests (
  id                uuid primary key default gen_random_uuid(),
  venue_id          uuid not null references public.venues(id) on delete cascade,

  -- Ownership: a Request belongs to one Booking (event) and one Client
  -- Workspace (client) — never directly to a feature module. event_id is
  -- nullable because a client can exist before an event date is set, same
  -- as the rest of the Bookings domain (see clients.linkedEventId).
  client_id         uuid not null references public.clients(id) on delete cascade,
  event_id          uuid references public.events(id) on delete cascade,

  title             text not null check (char_length(trim(title)) > 0),
  description       text,

  request_type      text not null check (request_type in (
    'document', 'approval', 'information', 'selection', 'upload', 'confirmation', 'task'
  )),

  status            text not null default 'draft' check (status in (
    'draft', 'sent', 'viewed', 'in_progress', 'submitted', 'reviewed', 'completed', 'cancelled'
  )),

  visibility        text not null default 'venue_only' check (visibility in (
    'venue_only', 'shared', 'completed'
  )),

  due_date          date,

  requested_by_user_id uuid references auth.users(id),
  assigned_to_staff_id  uuid references public.venue_staff(id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz,
  reviewed_at        timestamptz
);

alter table public.requests enable row level security;

create policy "venue manages own requests"
  on public.requests for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.requests to authenticated;

create index requests_client on public.requests (client_id);
create index requests_event  on public.requests (event_id) where event_id is not null;
create index requests_venue_status on public.requests (venue_id, status);
create index requests_assigned on public.requests (assigned_to_staff_id) where assigned_to_staff_id is not null;

-- ── Lifecycle event log ───────────────────────────────────────────────────
-- Append-only record of every status transition. This is the seam future
-- notification systems hook into (via lib/requests' in-process lifecycle
-- registry at write time, and/or by reading this table) — it is data, not
-- a delivery mechanism. No emails, no in-app alerts are sent from here.

create table public.request_lifecycle_events (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests(id) on delete cascade,
  event_type   text not null check (event_type in (
    'created', 'status_changed', 'assigned', 'reassigned'
  )),
  from_status  text,
  to_status    text,
  actor_user_id uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

alter table public.request_lifecycle_events enable row level security;

create policy "venue reads lifecycle events for its own requests"
  on public.request_lifecycle_events for select
  using (exists (
    select 1 from public.requests r
    where r.id = request_lifecycle_events.request_id
      and r.venue_id = public.current_user_venue_id()
  ));

create policy "venue inserts lifecycle events for its own requests"
  on public.request_lifecycle_events for insert
  with check (exists (
    select 1 from public.requests r
    where r.id = request_lifecycle_events.request_id
      and r.venue_id = public.current_user_venue_id()
  ));

grant select, insert on public.request_lifecycle_events to authenticated;

create index request_lifecycle_events_request on public.request_lifecycle_events (request_id, created_at);

notify pgrst, 'reload schema';
