-- Phase B1 — Guided Setup & Truthful Readiness (Milestone 02)
-- Additive columns only. Does not overwrite existing venue_setup_hub_state values.
-- Does not backfill Ready. Does not change accepted_inquiry_event_types (public inquiry).
-- DO NOT APPLY to Sandbox or Production without explicit authorization.

alter table public.venue_setup_hub_state
  add column if not exists hosted_event_types text[];

alter table public.venue_setup_hub_state
  add column if not exists hosted_event_types_set_at timestamptz;

alter table public.venue_setup_hub_state
  add column if not exists event_experience_reviews jsonb not null default '{}'::jsonb;

alter table public.venue_setup_hub_state
  add column if not exists booking_process_reviewed_at timestamptz;

alter table public.venue_setup_hub_state
  add column if not exists communications_reviewed_at timestamptz;

alter table public.venue_setup_hub_state
  add column if not exists operational_resources_reviewed_at timestamptz;

alter table public.venue_setup_hub_state
  add column if not exists operational_resource_choices jsonb not null default '{}'::jsonb;

alter table public.venue_setup_hub_state
  drop constraint if exists venue_setup_hub_state_event_experience_reviews_object;

alter table public.venue_setup_hub_state
  add constraint venue_setup_hub_state_event_experience_reviews_object
  check (jsonb_typeof(event_experience_reviews) = 'object');

alter table public.venue_setup_hub_state
  drop constraint if exists venue_setup_hub_state_operational_resource_choices_object;

alter table public.venue_setup_hub_state
  add constraint venue_setup_hub_state_operational_resource_choices_object
  check (jsonb_typeof(operational_resource_choices) = 'object');

comment on column public.venue_setup_hub_state.hosted_event_types is
  'Phase B1: event types this venue deliberately hosts in HTC. Null = never selected. Independent of public inquiry types.';

comment on column public.venue_setup_hub_state.event_experience_reviews is
  'Phase B1: per event-type Setup Profile review confirmations. Existence of a starter profile is never itself Ready.';

comment on column public.venue_setup_hub_state.booking_process_reviewed_at is
  'Phase B1: owner confirmed essential booking configuration after review. Unpriced starters never count.';

comment on column public.venue_setup_hub_state.communications_reviewed_at is
  'Phase B1: owner reviewed message templates and automations. Does not activate sequences or require SMS.';

comment on column public.venue_setup_hub_state.operational_resources_reviewed_at is
  'Phase B1: owner reviewed planning tools and confirmed intended usage. Optional features may remain unused.';
