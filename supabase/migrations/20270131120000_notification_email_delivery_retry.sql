-- Notification email delivery retry lifecycle.
--
-- Stops immediate infinite retries of Resend invalid-recipient / rate-limit /
-- quota failures from task_reminders + venue_notifications processors.
-- Reuses the same bounded exponential-backoff shape as QuickBooks / Facebook
-- queues (attempt_count + next_attempt_at), without a new queue service.

-- ── task_reminders ───────────────────────────────────────────────────────────

alter table public.task_reminders
  drop constraint if exists task_reminders_status_check;

alter table public.task_reminders
  add constraint task_reminders_status_check check (status in (
    'pending',
    'sent',
    'cancelled',
    'skipped',
    'failed'  -- terminal delivery failure (invalid recipient, exhausted retries)
  ));

alter table public.task_reminders
  add column if not exists attempt_count integer not null default 0
    check (attempt_count >= 0),
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;

comment on column public.task_reminders.attempt_count is
  'Completed send attempts for this reminder. Incremented on each failure before defer/terminal.';
comment on column public.task_reminders.next_attempt_at is
  'Earliest time the delivery engine may attempt this pending reminder again (backoff / lease).';
comment on column public.task_reminders.last_error_code is
  'Last classified delivery failure code (rate_limit, quota, invalid_recipient, …).';
comment on column public.task_reminders.last_error_message is
  'Operator-safe last delivery failure message (no secrets / raw provider dumps).';

create index if not exists task_reminders_pending_next_attempt
  on public.task_reminders (next_attempt_at, scheduled_for)
  where status = 'pending';

-- ── venue_notifications (email dispatch half) ────────────────────────────────

alter table public.venue_notifications
  add column if not exists email_attempt_count integer not null default 0
    check (email_attempt_count >= 0),
  add column if not exists email_next_attempt_at timestamptz not null default now(),
  add column if not exists email_last_error_code text,
  add column if not exists email_last_error_message text;

comment on column public.venue_notifications.email_attempt_count is
  'Completed email send attempts while needs_email and emailed_at is null.';
comment on column public.venue_notifications.email_next_attempt_at is
  'Earliest time email dispatch may retry (null = eligible when needs_email).';
comment on column public.venue_notifications.email_last_error_code is
  'Last classified email delivery failure code.';
comment on column public.venue_notifications.email_last_error_message is
  'Operator-safe last email delivery failure message.';

-- Existing backlog becomes immediately eligible once; new failures set backoff.
update public.venue_notifications
set email_next_attempt_at = now()
where needs_email = true
  and emailed_at is null
  and email_next_attempt_at is null;

create index if not exists venue_notifications_email_next_attempt
  on public.venue_notifications (email_next_attempt_at)
  where needs_email and emailed_at is null;
