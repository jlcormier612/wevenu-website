-- ============================================================================
-- Venue account access lock (CRM Suspend / unpaid dunning)
--
-- When Relationship Workspace suspends a customer (manual or day-21 dunning),
-- product venues are hard-locked. Data is preserved — never deleted.
-- Columns are additive and default to unlocked for all existing venues.
-- ============================================================================

alter table public.venues
  add column if not exists access_disabled boolean not null default false;

alter table public.venues
  add column if not exists account_status text not null default 'active';

alter table public.venues
  drop constraint if exists venues_account_status_check;

alter table public.venues
  add constraint venues_account_status_check
  check (account_status in ('active', 'suspended'));

-- SaaS (Hello to Cheers) Stripe Customer id for Billing Portal from the
-- product suspend screen. Distinct from stripe_account_id (Connect).
alter table public.venues
  add column if not exists saas_stripe_customer_id text;

comment on column public.venues.access_disabled is
  'Hard lock from CRM Suspend / unpaid dunning. True → product app redirect to /billing/suspended. Data preserved.';

comment on column public.venues.account_status is
  'active | suspended — mirrors access_disabled for reporting and future states.';

comment on column public.venues.saas_stripe_customer_id is
  'Stripe Customer id for Hello to Cheers SaaS billing (Billing Portal). Not Connect.';

create index if not exists venues_access_disabled_idx
  on public.venues (access_disabled)
  where access_disabled = true;
