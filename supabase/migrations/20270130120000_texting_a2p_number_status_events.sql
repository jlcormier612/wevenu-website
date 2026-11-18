-- A2P phone-number registration status automation:
-- Event Streams sink/subscription tracking, phone status timestamps,
-- and idempotent event intake for number-registration lifecycle events.
-- Do not apply until founder-authorized Sandbox migration.

alter table public.venue_twilio_accounts
  add column if not exists event_stream_sink_sid text;

alter table public.venue_twilio_accounts
  add column if not exists event_stream_subscription_sid text;

alter table public.venue_twilio_accounts
  add column if not exists phone_a2p_status_updated_at timestamptz;

alter table public.venue_twilio_accounts
  add column if not exists phone_a2p_last_event_at timestamptz;

alter table public.venue_twilio_accounts
  drop constraint if exists venue_twilio_accounts_event_stream_sink_sid_format;

alter table public.venue_twilio_accounts
  add constraint venue_twilio_accounts_event_stream_sink_sid_format
  check (
    event_stream_sink_sid is null
    or event_stream_sink_sid ~ '^DG[0-9a-fA-F]{32}$'
  );

alter table public.venue_twilio_accounts
  drop constraint if exists venue_twilio_accounts_event_stream_subscription_sid_format;

alter table public.venue_twilio_accounts
  add constraint venue_twilio_accounts_event_stream_subscription_sid_format
  check (
    event_stream_subscription_sid is null
    or event_stream_subscription_sid ~ '^DF[0-9a-fA-F]{32}$'
  );

create table if not exists public.venue_twilio_a2p_events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  twilio_account_sid text not null,
  event_id text not null,
  event_type text not null,
  event_time timestamptz,
  phone_number_sid text,
  messaging_service_sid text,
  campaign_sid text,
  external_status text,
  applied boolean not null default false,
  ignored_reason text,
  created_at timestamptz not null default now(),
  constraint venue_twilio_a2p_events_event_id_unique unique (event_id)
);

create index if not exists venue_twilio_a2p_events_venue_created_idx
  on public.venue_twilio_a2p_events (venue_id, created_at desc);

alter table public.venue_twilio_a2p_events enable row level security;

-- Service role only — contains provider event identifiers, not venue-facing.
grant select, insert, update, delete on public.venue_twilio_a2p_events to service_role;

notify pgrst, 'reload schema';
