-- ============================================================================
-- Sprint 44: Notification Delivery Infrastructure
--
-- Channel-agnostic from day one.
-- Even though Sprint 44 only sends email, the schema understands:
--   email | sms | in_app | push
--
-- "I'd rather build the engine once than unwind an email-only assumption later."
--
-- notification_log: immutable record of every notification sent.
--   Audit trail, dedup guard, future analytics (channel conversion rates, etc.)
--
-- notification_preferences: per-venue, per-role channel preferences.
--   Sprint 44: not exposed in UI, but schema is ready.
--   Allows: coordinator prefers in_app, couple prefers sms for urgent reminders.
-- ============================================================================

-- ── Notification log (immutable audit trail) ─────────────────────────────────

create table public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,

  -- What triggered this notification
  source_type     text not null check (source_type in (
    'task_reminder',   -- from task_reminders table
    'task_overdue',    -- escalation for overdue task
    'task_complete',   -- notify coordinator when couple/vendor finishes
    'message',         -- new message in a thread
    'invoice',         -- invoice due / payment received
    'system'           -- platform-generated (welcome, onboarding, etc.)
  )),
  source_id       uuid,   -- task_reminder.id, message_thread.id, invoice.id, etc.

  -- Who receives it
  recipient_role  text not null check (recipient_role in (
    'coordinator', 'couple', 'vendor', 'team'
  )),
  recipient_email text,   -- actual address used (null if in_app or push)
  recipient_phone text,   -- actual number used (null if not SMS)

  -- Channel — stored always, even if all channels are 'email' in Sprint 44.
  -- Future reporting: "email open rate 40%, SMS click rate 70%"
  channel text not null check (channel in ('email', 'sms', 'in_app', 'push')),

  -- Delivery outcome
  status text not null default 'sent' check (status in (
    'sent',       -- handed off to delivery provider
    'delivered',  -- confirmed delivery (via webhook)
    'failed',     -- provider rejected or error
    'bounced'     -- hard bounce (invalid address)
  )),

  -- Message content (stored for audit — first 500 chars of body)
  subject      text,
  body_preview text,

  -- Provider tracking
  provider_message_id text,  -- Resend message ID, Twilio SID, etc.

  sent_at      timestamptz not null default now(),
  delivered_at timestamptz,
  error_message text
);

-- RLS: venue owner reads their own notification history
alter table public.notification_log enable row level security;

create policy "venue owner reads notification log"
  on public.notification_log for select
  using (exists (
    select 1 from public.venues
    where id = notification_log.venue_id
      and owner_user_id = auth.uid()
  ));

-- No INSERT policy via RLS — delivery engine uses service role.
-- Grant read to authenticated users for settings UI.
grant select on public.notification_log to authenticated;

-- Index for settings UI: recent notifications per venue
create index notification_log_venue_recent
  on public.notification_log (venue_id, sent_at desc);

-- Index for dedup: has this source already been notified?
create index notification_log_source
  on public.notification_log (source_type, source_id)
  where source_id is not null;

-- ── Notification preferences (per-venue, per-role) ───────────────────────────
-- Schema ready now. UI exposed in Sprint 45+.

create table public.notification_preferences (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  role             text not null check (role in ('coordinator', 'couple', 'vendor', 'team')),

  -- Channel preference per notification type
  -- null = use system default (email)
  task_upcoming_channel text check (task_upcoming_channel in ('email', 'sms', 'in_app', 'push')),
  task_overdue_channel  text check (task_overdue_channel  in ('email', 'sms', 'in_app', 'push')),
  task_complete_channel text check (task_complete_channel in ('email', 'sms', 'in_app', 'push')),
  message_channel       text check (message_channel       in ('email', 'sms', 'in_app', 'push')),
  invoice_channel       text check (invoice_channel       in ('email', 'sms', 'in_app', 'push')),

  -- Global opt-out per channel (e.g., couple opts out of SMS)
  email_enabled boolean not null default true,
  sms_enabled   boolean not null default false,  -- off until SMS is built
  in_app_enabled boolean not null default true,
  push_enabled   boolean not null default false,  -- off until push is built

  unique (venue_id, role),
  created_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "venue owner manages notification preferences"
  on public.notification_preferences for all
  using (exists (
    select 1 from public.venues
    where id = notification_preferences.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.notification_preferences to authenticated;

-- Seed default preferences for each role
-- These can be overridden per-venue in Settings → Notifications (Sprint 45)
-- (Not inserting yet — venue_id is required and we don't know it at migration time)

notify pgrst, 'reload schema';
