-- ============================================================================
-- Calendar UX corrections — manual Schedule Items
--
-- Two additive changes to public.calendar_blocks, the table behind every
-- manually-created Schedule Item (Tour, Consultation, Walkthrough, Blocked
-- Time, Booking placeholder, ...):
--
--   1. "Related to" — an optional link to the Lead or Client a schedule item
--      is about. Deliberately two nullable FK columns, exactly mirroring the
--      relationship shape this codebase already uses everywhere else
--      (date_holds.lead_id, events.client_id, requests.client_id/event_id,
--      calendar_blocks.converted_lead_id). No polymorphic owner_type/owner_id
--      pair and no join table: a second relationship structure for one
--      optional association would be a parallel system, not a reuse of the
--      existing one.
--
--   2. Custom recurrence — interval and occurrence-count, extending the
--      existing recurrence_rule/recurrence_ends_on model rather than
--      replacing it. recurrence_rule stays the frequency; recurrence_interval
--      is the "every N" multiplier; the series ends on a date, after a
--      number of occurrences, or never (both null). Existing rows keep
--      working unchanged: interval defaults to 1, count defaults to null,
--      which is precisely the current every-1-forever behaviour.
--
-- Additive and idempotent. No column is dropped, no existing value rewritten.
-- ============================================================================

alter table public.calendar_blocks
  add column if not exists lead_id   uuid references public.leads (id)   on delete set null,
  add column if not exists client_id uuid references public.clients (id) on delete set null,
  add column if not exists recurrence_interval integer not null default 1,
  add column if not exists recurrence_count    integer;

comment on column public.calendar_blocks.lead_id is
  'Optional "Related to" link — the Lead this schedule item is about. Set null on lead delete: losing the association must never delete the calendar entry.';
comment on column public.calendar_blocks.client_id is
  'Optional "Related to" link — the booked Client this schedule item is about. Mutually exclusive with lead_id.';
comment on column public.calendar_blocks.recurrence_interval is
  'The "every N" multiplier for recurrence_rule (2 + weekly = every two weeks). Always >= 1; 1 for every pre-existing row, which is the behaviour they already had.';
comment on column public.calendar_blocks.recurrence_count is
  'End-after-N-occurrences. Mutually exclusive with recurrence_ends_on; both null = repeats indefinitely.';

-- A schedule item is about one thing. Allowing both would create a second,
-- ambiguous answer to "who is this for" with no rule for which one wins.
alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_related_to_one_of;
alter table public.calendar_blocks
  add constraint calendar_blocks_related_to_one_of
  check (lead_id is null or client_id is null);

-- Widen the frequency vocabulary with 'monthly'. The original constraint was
-- created inline by 20260703160000 and so carries Postgres's default name.
alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_recurrence_rule_check;
alter table public.calendar_blocks
  add constraint calendar_blocks_recurrence_rule_check
  check (recurrence_rule in ('none', 'daily', 'weekly', 'monthly', 'annual'));

alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_recurrence_interval_check;
alter table public.calendar_blocks
  add constraint calendar_blocks_recurrence_interval_check
  check (recurrence_interval >= 1);

alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_recurrence_count_check;
alter table public.calendar_blocks
  add constraint calendar_blocks_recurrence_count_check
  check (recurrence_count is null or recurrence_count >= 1);

-- One end condition, never two — a series that ends both "on Dec 1" and
-- "after 10 times" has no single truth about when it stops.
alter table public.calendar_blocks
  drop constraint if exists calendar_blocks_recurrence_end_one_of;
alter table public.calendar_blocks
  add constraint calendar_blocks_recurrence_end_one_of
  check (recurrence_ends_on is null or recurrence_count is null);

create index if not exists calendar_blocks_lead
  on public.calendar_blocks (lead_id) where lead_id is not null;
create index if not exists calendar_blocks_client
  on public.calendar_blocks (client_id) where client_id is not null;

-- RLS is unchanged: calendar_blocks_all is row-scoped by venue_id and already
-- covers every column, including these.

notify pgrst, 'reload schema';
