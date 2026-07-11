-- ============================================================================
-- Automated Series — Communication Platform Phase 3 (2026-07-14)
--
-- docs/communication-platform-next-phase.md §3. Internal/engineering name
-- stays "sequence" throughout this schema and the codebase (§3.6) — "Series"
-- is the UI-facing term only.
--
-- Deliberately reuses Scheduled Sends (Phase 2) as the actual send
-- mechanism rather than building a parallel one: enrolling a relationship
-- in a sequence materializes one scheduled_messages row per step, with
-- absolute send times computed cumulatively at enrollment time. The
-- existing processor (lib/scheduled-messages/processor.ts) already sends
-- real email/SMS and logs into the Conversation timeline — nothing about it
-- changes here, it just gains two nullable columns so a sent/pending
-- message can be traced back to which sequence and step produced it.
--
-- Scope note: this phase builds freestanding sequences (the pre-booking
-- "Sales Series" primary capability, §3.0) — a Planning-task link (the
-- post-booking preferred pattern) is not built here; "stop on task
-- completion" therefore has nothing to attach to yet and isn't wired.
-- ============================================================================

create table public.message_sequences (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,

  name         text not null,
  status       text not null default 'active' check (status in ('active', 'paused')),

  -- Rule-based enrollment (§3.2) — null trigger_type means manual-only.
  -- trigger_stage is only meaningful when trigger_type = 'lead_stage_changed'.
  trigger_type  text check (trigger_type in ('lead_created', 'lead_stage_changed')),
  trigger_stage text check (trigger_stage in ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'cancelled')),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index message_sequences_venue on public.message_sequences (venue_id);
-- The trigger-matching query (rule-based enrollment) needs to find active
-- sequences for a given trigger quickly, scoped to one venue at a time.
create index message_sequences_trigger on public.message_sequences (venue_id, trigger_type)
  where status = 'active' and trigger_type is not null;

create trigger message_sequences_updated_at
  before update on public.message_sequences
  for each row execute function public.set_updated_at();

create table public.sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  sequence_id  uuid not null references public.message_sequences (id) on delete cascade,

  -- restrict, not cascade/set null — a template actively used by a live
  -- step shouldn't silently disappear out from under it (the "Template
  -- Usage visibility" backlog item names the coordinator-facing side of
  -- this same concern).
  template_id  uuid not null references public.message_templates (id) on delete restrict,
  channel      text not null check (channel in ('email', 'sms')),

  sort_order   int not null default 0,
  -- Delay from the previous step's send time (or from enrollment, for the
  -- first step) — not from enrollment for every step. Matches §3.1 exactly.
  offset_days  int not null default 0,

  created_at   timestamptz not null default now()
);

create index sequence_steps_sequence on public.sequence_steps (sequence_id, sort_order);

create table public.sequence_enrollments (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid not null references public.venues (id) on delete cascade,
  sequence_id     uuid not null references public.message_sequences (id) on delete cascade,
  relationship_id uuid not null references public.venue_customer_relationships (id) on delete cascade,

  status          text not null default 'active'
                    check (status in ('active', 'completed', 'exited_reply', 'exited_booking', 'cancelled')),
  enrolled_at     timestamptz not null default now(),
  exited_at       timestamptz,

  created_at      timestamptz not null default now()
);

-- One active enrollment per (sequence, relationship) at a time — re-running
-- a rule-based trigger for someone already in the sequence is a no-op, not
-- a duplicate enrollment.
create unique index sequence_enrollments_active_unique
  on public.sequence_enrollments (sequence_id, relationship_id)
  where status = 'active';

-- The exit-rule hooks (stop on reply, stop on booking) look up "does this
-- relationship have any active enrollment" — this is that lookup's index.
create index sequence_enrollments_relationship_active
  on public.sequence_enrollments (relationship_id)
  where status = 'active';

-- ---- Link scheduled_messages back to the sequence/step that created it ----
alter table public.scheduled_messages
  add column sequence_enrollment_id uuid references public.sequence_enrollments (id) on delete cascade,
  add column sequence_step_id       uuid references public.sequence_steps (id) on delete set null;

create index scheduled_messages_enrollment
  on public.scheduled_messages (sequence_enrollment_id)
  where sequence_enrollment_id is not null;

-- ---- RLS ---------------------------------------------------------------------
alter table public.message_sequences  enable row level security;
alter table public.sequence_steps     enable row level security;
alter table public.sequence_enrollments enable row level security;

create policy message_sequences_all on public.message_sequences
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy sequence_steps_all on public.sequence_steps
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy sequence_enrollments_all on public.sequence_enrollments
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.message_sequences     to authenticated;
grant select, insert, update, delete on public.sequence_steps        to authenticated;
grant select, insert, update, delete on public.sequence_enrollments  to authenticated;

notify pgrst, 'reload schema';
