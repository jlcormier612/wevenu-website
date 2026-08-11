-- Work Package D7C — Saved Reports.
--
-- This is a thin persistence/delivery layer over Reporting (R1-R3), which
-- is already complete and authoritative — this migration adds NO new
-- metric, NO new report calculation, NO new date-range semantics. A saved
-- report stores exactly what this phase's own research confirmed is
-- sufficient to fully reconstruct any report view: which report page, and
-- which date-range mode. `date_preset` stores the *mode*
-- ("this_month", "last_quarter", etc.), not literal computed dates — every
-- report page already resolves a preset to real from/to values fresh on
-- every render (lib/reporting/date-range.ts resolveDateRange), so a
-- relative saved report is always current, never a frozen snapshot. Only
-- `custom` needs literal from/to, since that mode has no relative meaning.
--
-- RLS shape — a deliberate choice, not the default template pattern:
-- Saved Reports are closer to `document_workspace_pins` (a personal/team
-- bookmark, `pinned_by` attribution only, no special delete restriction)
-- than to a governed, venue-wide reusable business asset like a Contract
-- Template. Any team member can save, open, or remove any saved report on
-- their own venue — there's no cross-user risk to gate against, since
-- schedules (below) only ever deliver to the creating user's own email.

create table public.saved_reports (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references public.venues (id) on delete cascade,
  created_by    uuid references auth.users (id) on delete set null,

  name          text not null check (char_length(trim(name)) > 0),
  report_path   text not null check (report_path in ('/reporting', '/reporting/sales', '/reporting/bookings', '/reporting/revenue', '/reporting/events')),
  date_preset   text not null,
  custom_from   date,
  custom_to     date,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index saved_reports_venue on public.saved_reports (venue_id);

create trigger saved_reports_updated_at
  before update on public.saved_reports
  for each row execute function public.set_updated_at();

-- "Send me this every Monday" (brief §24) — recipient_email defaults to
-- the creating user's own account email (pre-filled in the UI) but stays
-- editable, since a real venue may want it at a personal inbox or a
-- bookkeeper's address. Because that means a schedule CAN target an
-- arbitrary address, creating/editing one is gated to Owner/Manager
-- (lib/saved-reports/service.ts::setSchedule) — the same weight class as
-- other Owner/Manager-only actions in this codebase (template delete,
-- contract delete), not the low-stakes act of saving a personal view.
create table public.saved_report_schedules (
  id                uuid primary key default gen_random_uuid(),
  saved_report_id   uuid not null references public.saved_reports (id) on delete cascade,
  venue_id          uuid not null references public.venues (id) on delete cascade,
  created_by        uuid references auth.users (id) on delete set null,

  recipient_email   text not null,
  day_of_week       smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday, matches JS Date#getDay()
  is_active         boolean not null default true,

  last_sent_at      timestamptz,
  last_sent_hash    text,   -- content-hash dedupe, same discipline as the daily digest (lib/notifications/digest-engine.ts)

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (saved_report_id) -- one schedule per saved report keeps this simple; delete and recreate to change cadence
);

create index saved_report_schedules_venue on public.saved_report_schedules (venue_id);
create index saved_report_schedules_due on public.saved_report_schedules (day_of_week) where is_active;

create trigger saved_report_schedules_updated_at
  before update on public.saved_report_schedules
  for each row execute function public.set_updated_at();

-- ---- RLS -----------------------------------------------------------------------
alter table public.saved_reports          enable row level security;
alter table public.saved_report_schedules enable row level security;

create policy saved_reports_all on public.saved_reports
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

create policy saved_report_schedules_all on public.saved_report_schedules
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.saved_reports          to authenticated;
grant select, insert, update, delete on public.saved_report_schedules to authenticated;

-- ---- Scheduled delivery (brief §24) — the digest's own exact skeleton ----------
-- (lib/notifications/digest-engine.ts): a SECURITY DEFINER "who's due"
-- RPC, restricted to service_role only (the cron route runs with no user
-- session), joined to auth.users for the delivery target already stored
-- on the schedule itself.
create or replace function public.get_due_saved_report_schedules(p_day_of_week smallint)
returns table (
  schedule_id       uuid,
  saved_report_id   uuid,
  venue_id          uuid,
  recipient_email   text,
  last_sent_hash    text,
  report_name       text,
  report_path       text,
  date_preset       text,
  custom_from       date,
  custom_to         date
)
language sql
security definer
set search_path = public
as $$
  select
    s.id, s.saved_report_id, s.venue_id, s.recipient_email, s.last_sent_hash,
    r.name, r.report_path, r.date_preset, r.custom_from, r.custom_to
  from public.saved_report_schedules s
  join public.saved_reports r on r.id = s.saved_report_id
  where s.is_active and s.day_of_week = p_day_of_week
    and (s.last_sent_at is null or s.last_sent_at < date_trunc('day', now()));
$$;

revoke all on function public.get_due_saved_report_schedules(smallint) from public;
grant execute on function public.get_due_saved_report_schedules(smallint) to service_role;

create or replace function public.mark_saved_report_schedule_sent(p_schedule_id uuid, p_hash text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.saved_report_schedules
  set last_sent_at = now(), last_sent_hash = p_hash
  where id = p_schedule_id;
$$;

revoke all on function public.mark_saved_report_schedule_sent(uuid, text) from public;
grant execute on function public.mark_saved_report_schedule_sent(uuid, text) to service_role;

notify pgrst, 'reload schema';
