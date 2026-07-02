-- ============================================================================
-- Sprint 47: Tour Lifecycle Fields + Post-Tour Automation Foundation
--
-- Tours are the highest-intent moment in the lead sales process.
-- What happens in the 48 hours after a tour determines conversion rate.
--
-- This migration adds:
--   1. Lifecycle tracking fields on tour_appointments
--   2. tour_completed / tour_no_show / tour_cancelled to lead_signal_events type list
--
-- Post-tour automation fires when status transitions to:
--   completed → thank-you + proposal follow-up tasks + Luv observation
--   no_show   → reschedule recommendation in Luv
--   cancelled → alternative date recommendation in Luv
-- ============================================================================

-- ── Tour lifecycle fields ────────────────────────────────────────────────────

alter table public.tour_appointments
  add column assigned_to       text,          -- coordinator name or initials
  add column confirmed_at      timestamptz,   -- when coordinator confirmed the appointment
  add column completed_at      timestamptz,   -- set when status → 'completed'
  add column follow_up_sent_at timestamptz,   -- set when thank-you/follow-up sent
  add column outcome           text check (outcome in (
    'interested',     -- couple expressed strong interest, likely to book
    'considering',    -- considering, comparing other venues
    'not_a_fit',      -- venue not right for them (capacity, style, date, budget)
    'booked',         -- converted to booking (linked to a client record)
    'unknown'         -- tour happened but no clear outcome captured
  ));
  -- notes column already exists from Sprint 45 migration

-- Auto-set completed_at when status becomes 'completed' via trigger
create or replace function public.set_tour_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and old.status != 'completed' and new.completed_at is null then
    new.completed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger tour_appointments_lifecycle
  before update on public.tour_appointments
  for each row execute function public.set_tour_completed_at();

-- Index: find tours completed but not yet followed up (for Luv observations)
create index tour_appointments_completed_no_followup
  on public.tour_appointments (venue_id, completed_at)
  where status = 'completed' and follow_up_sent_at is null;

-- Index: find recent no-shows (for Luv observations)
create index tour_appointments_no_show_recent
  on public.tour_appointments (venue_id, scheduled_at)
  where status = 'no_show';

-- ── Lead signal events for tour outcomes ────────────────────────────────────
-- Extends the signal event system to capture post-tour moments.
-- These feed into commitment score and Luv momentum observations.

comment on column public.lead_signal_events.signal_type is
  'Canonical signal types: form_view, email_open, email_click, email_reply,
   proposal_click, payment_link_click, tour_scheduled, tour_completed,
   tour_no_show, tour_cancelled';

-- (The lead_signal_events table accepts any event_type text — no schema change needed.
--  This comment documents the canonical list.)

notify pgrst, 'reload schema';
