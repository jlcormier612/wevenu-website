-- ============================================================================
-- Continuous Setup Experience — persistent Business Setup Hub state model.
--
-- Spec: docs/continuous-setup-experience-implementation-plan.md (§B, §G, §I).
--
-- Deliberately separate from venues.setup_completed / onboarding_dismissed /
-- setup_last_step, which remain scoped to the pre-workspace wizard only —
-- per explicit product direction, those fields are never repurposed here.
--
-- Two tables:
--   venue_setup_hub_state    — one row per venue, per-stage deliberate-review
--                              timestamps + the "Ready to Invite Couples"
--                              flag. Row-existence is not itself a signal;
--                              each column is null until the venue takes the
--                              specific deliberate action it represents.
--   venue_lead_capture_channels — one row per (venue, channel), tracking the
--                              approved Configured/Verified distinction for
--                              Lead Capture. A channel with no row is simply
--                              "not yet addressed" — never inferred as
--                              configured from any other table (e.g. the
--                              venue's embed_key existing, per plan §C).
--
-- onboarding_type is carried forward from venue_enrollments at first write
-- (plan §G) so a future White Glove integration doesn't need a retroactive
-- migration to add venue-vs-HQ provenance — this column is reserved now,
-- not yet read by any UI.
-- ============================================================================

create table public.venue_setup_hub_state (
  venue_id uuid primary key references public.venues (id) on delete cascade,

  onboarding_type text not null default 'self_setup'
    check (onboarding_type in ('self_setup', 'white_glove')),

  -- Your Venue — reserved; exact completion bar (plan §I, Your Venue image
  -- requirement) not yet decided, column exists so no later migration is
  -- needed once it is.
  your_venue_reviewed_at timestamptz,

  -- Calendar & Availability — reserved; exact mechanism is plan §I #2.
  calendar_availability_reviewed_at timestamptz,

  -- Bring Your Business — the "manual" choice has no other persisted
  -- signal anywhere (import/files already write real import_batches rows).
  -- Resolves plan §I #3.
  bring_your_business_manual_confirmed_at timestamptz,

  -- Your Offerings — reserved; exact mechanism is plan §I #4 (blocked on
  -- the inventory_items source_master_key schema question) plus the
  -- "reviewed starters as sufficient" acknowledgment gap noted in plan §B.
  your_offerings_reviewed_at timestamptz,

  -- Client Experience — reserved; scope itself is plan §I #1.
  client_experience_reviewed_at timestamptz,

  -- Lead Capture — the stage-level path choice. Per-channel state lives in
  -- venue_lead_capture_channels below. "automated" means at least one
  -- channel row satisfies the approved configure-and-verify-where-
  -- practical bar; "manual_external" is the explicit declared alternative.
  lead_capture_path text check (lead_capture_path in ('automated', 'manual_external')),
  lead_capture_path_decided_at timestamptz,

  -- Your Team — "just me for now" needs its own persisted acknowledgment;
  -- "has a team" is derived from venue_staff (accepted, active, non-owner)
  -- and needs no column here.
  your_team_solo_confirmed_at timestamptz,

  -- Financials — reserved; exact acknowledgment mechanism is plan §I #7.
  financials_reviewed_at timestamptz,

  -- Ready to Invite Couples — the terminal, deliberate, reversible state
  -- that gates Activation. Never inferred from any other column on this
  -- table or from setup_completed. Reversible: the venue can un-declare by
  -- clearing ready_to_invite_couples, which is why declared_at/declared_by
  -- are not sufficient alone as the gate — the boolean is authoritative.
  ready_to_invite_couples boolean not null default false,
  ready_to_invite_couples_at timestamptz,
  ready_to_invite_couples_declared_by uuid references auth.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger venue_setup_hub_state_updated_at
  before update on public.venue_setup_hub_state
  for each row execute function public.set_updated_at();

alter table public.venue_setup_hub_state enable row level security;

create policy venue_setup_hub_state_all on public.venue_setup_hub_state
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.venue_setup_hub_state to authenticated;
grant select, insert, update, delete on public.venue_setup_hub_state to service_role;

-- venue_lead_capture_channels --------------------------------------------------
create table public.venue_lead_capture_channels (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  channel    text not null
    check (channel in ('website_form', 'email_intake', 'tour_booking', 'qr_campaigns', 'facebook_lead_ads', 'manual')),
  configured_at timestamptz,
  verified_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, channel)
);

create index venue_lead_capture_channels_venue on public.venue_lead_capture_channels (venue_id);

create trigger venue_lead_capture_channels_updated_at
  before update on public.venue_lead_capture_channels
  for each row execute function public.set_updated_at();

alter table public.venue_lead_capture_channels enable row level security;

create policy venue_lead_capture_channels_all on public.venue_lead_capture_channels
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

grant select, insert, update, delete on public.venue_lead_capture_channels to authenticated;
grant select, insert, update, delete on public.venue_lead_capture_channels to service_role;
