-- Phase A — Welcome Experience & Four-Milestone Setup Hub
-- Additive columns only. Does not overwrite existing venue_setup_hub_state values.
-- Does not repurpose ready_to_invite_couples (still Phase D completion).

alter table public.venue_setup_hub_state
  add column if not exists welcome_explored_at timestamptz;

alter table public.venue_setup_hub_state
  add column if not exists existing_bookings_answer text
    check (existing_bookings_answer is null or existing_bookings_answer in ('yes', 'no'));

alter table public.venue_setup_hub_state
  add column if not exists existing_bookings_answered_at timestamptz;

alter table public.venue_setup_hub_state
  add column if not exists booking_rules_reviewed_at timestamptz;

comment on column public.venue_setup_hub_state.welcome_explored_at is
  'Phase A: set when owner first uses Explore your setup / Continue setup welcome CTA. Null = first-visit welcome.';

comment on column public.venue_setup_hub_state.existing_bookings_answer is
  'Phase A Milestone 01: explicit yes/no — never inferred from zero events.';

comment on column public.venue_setup_hub_state.booking_rules_reviewed_at is
  'Phase A Milestone 01: owner opened/reviewed booking & availability rules.';
