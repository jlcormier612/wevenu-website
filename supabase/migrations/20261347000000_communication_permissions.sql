-- Communication permission / suppression (Trust Pass — smallest safe layer).
--
-- SMS: phone ≠ texting permission. Persist STOP/START/provider-blocked state
-- and enforce outbound SMS/MMS server-side. Do NOT invent a full consent CMS.
--
-- Email: persist hard-bounce / complaint / unsubscribe suppression so future
-- conversation sends do not knowingly re-mail suppressed addresses.
--
-- Status vocabulary (channel-agnostic):
--   not_opted_in      — no affirmative permission recorded (SMS default;
--                       relationship SMS ALLOWED in current release —
--                       do NOT hard-block until first-party consent UX ships)
--   opted_in          — START / explicit opt-in evidence
--   opted_out         — STOP / unsubscribe
--   provider_blocked  — provider refused (e.g. Twilio 21610) or hard bounce/complaint
--
-- P1 backlog (not this migration): First-party SMS consent capture and
-- consent evidence (opt-in UX, source, timestamp, language/version, audit).

create table if not exists public.communication_permissions (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  channel         text not null check (channel in ('sms', 'email')),
  -- Normalized address: E.164 digits for SMS (+1…), lowercased email for email
  address_key     text not null,
  status          text not null check (status in (
                    'not_opted_in', 'opted_in', 'opted_out', 'provider_blocked'
                  )),
  source          text not null default 'system',
  evidence        jsonb not null default '{}'::jsonb,
  consent_text    text,
  relationship_id uuid references public.venue_customer_relationships(id) on delete set null,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (venue_id, channel, address_key)
);

create index if not exists communication_permissions_venue_channel
  on public.communication_permissions (venue_id, channel, status);

alter table public.communication_permissions enable row level security;

create policy communication_permissions_venue on public.communication_permissions
  for all
  using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update on public.communication_permissions to authenticated;
grant select, insert, update on public.communication_permissions to service_role;

notify pgrst, 'reload schema';
