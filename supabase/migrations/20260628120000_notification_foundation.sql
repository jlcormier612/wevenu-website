-- ============================================================================
-- Sprint 43: Notification Foundation
--
-- Three additions:
--
-- 1. Notification rules on playbook_tasks (and propagated to event_tasks)
--    reminder_before_days  integer[]  — specific pre-due-date reminders
--    escalation_after_days integer    — escalate to coordinator N days overdue
--    notify_on_assign      boolean    — notify owner when task is generated
--    notify_on_complete    boolean    — notify coordinator when completed
--
-- 2. task_reminders — pre-computed reminder schedule
--    Created immediately when a playbook is applied to an event.
--    Sits in 'pending' state until Sprint 44 activates the delivery engine.
--    One row per reminder instance (e.g., "7 days before", "3 days before", etc.)
--
-- 3. message_thread_participants — schema reservation
--    The Weven lesson: messaging visibility ≠ portal access.
--    Created now before portal messaging expands.
--    No UI yet — locked architecture prevents future refactoring.
--
-- North Star: "Coordinator manages exceptions, not steps."
-- ============================================================================

-- ── 1. Notification rules on playbook_tasks ─────────────────────────────────

alter table public.playbook_tasks
  -- Specific days before due date to remind: ARRAY[7, 3, 1] = 7, 3, 1 day before
  -- null means use venue default (Sprint 44 will expose venue-level defaults)
  add column reminder_before_days  integer[],
  -- Escalate to coordinator N days after due if still not complete (null = no escalation)
  add column escalation_after_days integer
    check (escalation_after_days is null or escalation_after_days > 0),
  -- Notify owner (couple/vendor/coordinator) when task is first assigned/generated
  add column notify_on_assign      boolean not null default false,
  -- Notify coordinator when a couple- or vendor-owned task is completed
  add column notify_on_complete    boolean not null default false;

-- Propagate the same columns to event_tasks (copied from template at apply time)
alter table public.event_tasks
  add column reminder_before_days  integer[],
  add column escalation_after_days integer
    check (escalation_after_days is null or escalation_after_days > 0),
  add column notify_on_assign      boolean not null default false,
  add column notify_on_complete    boolean not null default false;

-- ── 2. task_reminders — pre-computed schedule ────────────────────────────────

create table public.task_reminders (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues(id) on delete cascade,
  event_task_id   uuid not null references public.event_tasks(id) on delete cascade,

  -- What kind of reminder this is
  reminder_type   text not null check (reminder_type in (
    'upcoming',    -- N days before due date (from reminder_before_days array)
    'due_today',   -- day of due date
    'overdue',     -- N days after due date (from escalation_after_days)
    'escalation'   -- escalate to coordinator after extended overdue period
  )),

  -- Who should receive this reminder
  -- coordinator = venue coordinator; couple/vendor = portal/email notification
  notify_role     text not null check (notify_role in (
    'coordinator', 'couple', 'vendor', 'team'
  )),

  -- When the reminder should be sent (computed at task generation time)
  scheduled_for   timestamptz not null,

  -- Delivery status — 'pending' until Sprint 44 delivery engine processes it
  status          text not null default 'pending' check (status in (
    'pending',    -- awaiting delivery engine
    'sent',       -- successfully delivered
    'cancelled',  -- task completed or waived before reminder fired
    'skipped'     -- task completed after scheduled_for but before delivery ran
  )),

  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Index for delivery engine: find pending reminders due to fire
create index task_reminders_pending_due
  on public.task_reminders (scheduled_for, status)
  where status = 'pending';

-- Index for cancellation: when a task completes, cancel its pending reminders
create index task_reminders_by_task
  on public.task_reminders (event_task_id, status)
  where status = 'pending';

-- RLS: venue owner only
alter table public.task_reminders enable row level security;

create policy "venue owner manages task reminders"
  on public.task_reminders
  for all
  using (exists (
    select 1 from public.venues
    where id = task_reminders.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.task_reminders to authenticated;

-- ── 3. message_thread_participants — schema reservation ──────────────────────
--
-- The Weven lesson: portal access does NOT imply message visibility.
-- This table is the authoritative answer to "who can see this thread?"
-- UI: Sprint 44+. Architecture: locked now.

create table public.message_thread_participants (
  id               uuid primary key default gen_random_uuid(),
  venue_id         uuid not null references public.venues(id) on delete cascade,
  thread_id        uuid not null references public.message_threads(id) on delete cascade,

  -- Who is this participant?
  -- 'coordinator' = venue staff (no contact_id needed for now, auth.uid() implied)
  -- 'client'      = primary couple (contact_id = clients.id)
  -- 'client_contact' = additional contact (future: contact_id = client_contacts.id)
  -- 'vendor'      = vendor contact (contact_id = vendors.id)
  participant_type text not null check (participant_type in (
    'coordinator', 'client', 'client_contact', 'vendor'
  )),
  contact_id       uuid,   -- references clients.id, vendors.id, or future client_contacts.id

  -- Messaging-specific permissions — INDEPENDENT of portal access level
  -- This is the separation of concerns from the Weven lesson
  can_view                  boolean not null default true,
  can_reply                 boolean not null default false,
  receives_notifications    boolean not null default true,
  is_cc                     boolean not null default false,  -- CC'd on outbound emails

  added_by  text,  -- 'coordinator' | 'system' | participant name
  added_at  timestamptz not null default now(),

  unique (thread_id, participant_type, contact_id)
);

-- RLS: venue owner
alter table public.message_thread_participants enable row level security;

create policy "venue owner manages thread participants"
  on public.message_thread_participants
  for all
  using (exists (
    select 1 from public.venues
    where id = message_thread_participants.venue_id
      and owner_user_id = auth.uid()
  ));

grant select, insert, update, delete on public.message_thread_participants to authenticated;

-- Index for portal queries: "which threads can this contact see?"
create index thread_participants_by_contact
  on public.message_thread_participants (contact_id, can_view)
  where can_view = true;

notify pgrst, 'reload schema';
