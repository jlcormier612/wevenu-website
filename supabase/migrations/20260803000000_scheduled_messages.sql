-- ============================================================================
-- Scheduled Sends — Communication Platform Phase 2 (2026-07-14)
--
-- docs/communication-platform-next-phase.md §3.5. A distinct, simpler
-- sibling to Sequences/Series (not built yet, Phase 3): a coordinator
-- composes one message and picks a future send time instead of sending
-- immediately. No steps, no enrollment rules, no exit rules.
--
-- Channel is constrained to email/sms only — "portal" is explicitly
-- deferred per §5.1 until the couple's real portal Messages tab reads from
-- Conversations; offering it here would create a message that looks sent
-- but is functionally invisible to the couple.
--
-- Content is resolved (merge fields substituted) at send time, not at
-- schedule time — if the event date or client name changes between now and
-- when this fires, the sent message should reflect reality, not a stale
-- snapshot from when it was scheduled.
-- ============================================================================

create table public.scheduled_messages (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  relationship_id uuid not null references public.venue_customer_relationships (id) on delete cascade,
  template_id     uuid references public.message_templates (id) on delete set null,

  channel         text not null check (channel in ('email', 'sms')),
  email_subject   text,
  body            text not null, -- raw, with {{tokens}} — resolved at send time

  scheduled_for   timestamptz not null,
  status          text not null default 'scheduled'
                    check (status in ('scheduled', 'sent', 'failed', 'cancelled')),
  sent_at         timestamptz,
  error_message   text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- The processor's core query: due, still-scheduled messages, oldest first.
create index scheduled_messages_due
  on public.scheduled_messages (scheduled_for)
  where status = 'scheduled';

create index scheduled_messages_relationship
  on public.scheduled_messages (relationship_id, scheduled_for)
  where status = 'scheduled';

create trigger scheduled_messages_updated_at
  before update on public.scheduled_messages
  for each row execute function public.set_updated_at();

alter table public.scheduled_messages enable row level security;

create policy scheduled_messages_all on public.scheduled_messages
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.scheduled_messages to authenticated;

notify pgrst, 'reload schema';
