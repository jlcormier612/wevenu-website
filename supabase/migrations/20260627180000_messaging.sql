-- ============================================================================
-- Sprint 29 — Messaging Foundation
--
-- Three tables establishing messaging as a first-class platform capability:
--
--   message_threads   — conversations, linked to leads/clients/events
--   messages          — individual messages (outbound/inbound/system)
--   message_attachments — files attached to messages
--
-- Designed for extensibility:
--   channels: email → + sms → + internal (future)
--   direction: outbound → + inbound (requires webhook + email routing)
--   provider_id: stores Resend message ID for delivery tracking
--   status lifecycle: draft → sending → sent → delivered → failed
--
-- Deliverability is a first-class concern:
--   provider_id stored for tracking, bounce handling, unsubscribes (future)
--   SPF/DKIM/DMARC handled at the domain/Resend level, not in schema
-- ============================================================================

-- message_threads -------------------------------------------------------------
-- A conversation associated with one entity (lead, client, or event).
-- Exactly one entity FK must be non-null (enforced by CHECK).
-- thread.last_message_at is denormalized for efficient inbox sorting.
create table public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues  (id) on delete cascade,
  lead_id         uuid          references public.leads   (id) on delete cascade,
  client_id       uuid          references public.clients (id) on delete cascade,
  event_id        uuid          references public.events  (id) on delete cascade,

  subject         text,           -- email subject / thread display name
  channel         text not null default 'email'
                    check (channel in ('email', 'sms', 'system', 'internal')),
  status          text not null default 'active'
                    check (status in ('active', 'archived')),
  last_message_at timestamptz,    -- denormalized; updated on every message send
  message_count   integer not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Exactly one entity FK must be set (same pattern as documents)
  constraint threads_one_entity check (
    (lead_id   is not null)::int +
    (client_id is not null)::int +
    (event_id  is not null)::int = 1
  )
);

create index message_threads_venue  on public.message_threads (venue_id, last_message_at desc nulls last);
create index message_threads_lead   on public.message_threads (lead_id)   where lead_id   is not null;
create index message_threads_client on public.message_threads (client_id) where client_id is not null;
create index message_threads_event  on public.message_threads (event_id)  where event_id  is not null;

create trigger message_threads_updated_at
  before update on public.message_threads
  for each row execute function public.set_updated_at();

-- messages -------------------------------------------------------------------
-- Individual messages within a thread.
-- direction = outbound: venue → lead/client
-- direction = inbound:  lead/client → venue (future: via email reply webhook)
-- direction = system:   platform-generated (activity log entries, etc.)
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null references public.message_threads (id) on delete cascade,
  venue_id      uuid not null references public.venues           (id) on delete cascade,

  -- Direction and participants
  direction     text not null default 'outbound'
                  check (direction in ('outbound', 'inbound', 'system')),
  from_name     text,             -- sender display name
  from_email    text,             -- sender email address
  to_email      text,             -- recipient email (outbound)
  to_phone      text,             -- recipient phone (SMS, future)

  -- Content
  subject       text,             -- email subject (can differ per reply)
  body          text not null,    -- plain text body (always required)
  body_html     text,             -- optional rich HTML (future)

  -- Channel
  channel       text not null default 'email'
                  check (channel in ('email', 'sms', 'system', 'internal')),

  -- Delivery status
  status        text not null default 'draft'
                  check (status in ('draft', 'sending', 'sent', 'delivered', 'failed', 'received')),
  provider_id   text,             -- Resend email ID / Twilio SID (for tracking)
  error_message text,             -- populated on failure
  sent_at       timestamptz,
  delivered_at  timestamptz,      -- future: populated by webhook

  -- Luv integration — if this message was generated from a Luv draft
  luv_draft_id  uuid references public.luv_drafts (id) on delete set null,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index messages_thread   on public.messages (thread_id, created_at);
create index messages_venue    on public.messages (venue_id, created_at desc);
create index messages_provider on public.messages (provider_id) where provider_id is not null;

create trigger messages_updated_at
  before update on public.messages
  for each row execute function public.set_updated_at();

-- message_attachments --------------------------------------------------------
-- Foundation for future attachment support. Files stored in the existing
-- `documents` storage bucket (or a future `messages` bucket).
-- Sprint 29: table created, UI deferred to Sprint 30.
create table public.message_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.messages (id) on delete cascade,
  venue_id     uuid not null references public.venues   (id) on delete cascade,
  name         text not null,
  storage_path text not null,
  storage_url  text not null,
  mime_type    text,
  file_size    bigint,
  created_at   timestamptz not null default now()
);

create index message_attachments_message on public.message_attachments (message_id);

-- RLS -------------------------------------------------------------------------
alter table public.message_threads      enable row level security;
alter table public.messages             enable row level security;
alter table public.message_attachments  enable row level security;

create policy message_threads_all on public.message_threads
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy messages_all on public.messages
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

create policy message_attachments_all on public.message_attachments
  for all
  using      (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.venues v where v.id = venue_id and v.owner_user_id = auth.uid()));

grant select, insert, update, delete on public.message_threads     to authenticated;
grant select, insert, update, delete on public.messages            to authenticated;
grant select, insert, update, delete on public.message_attachments to authenticated;

notify pgrst, 'reload schema';
