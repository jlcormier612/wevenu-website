-- Phase 2 — Former Weven Customer offer (local migration only; not applied here).
-- Extends Phase 1A pricing tables for Weven self-declaration, claims, and applied offer audit.
-- Service-role only. Does not modify existing customer subscriptions.

-- ---------------------------------------------------------------------------
-- Checkout offers: persist Weven declaration + winning applied discount
-- ---------------------------------------------------------------------------
alter table public.saas_checkout_offers
  add column if not exists weven_declared boolean not null default false;

alter table public.saas_checkout_offers
  add column if not exists weven_percent_off integer
    check (weven_percent_off is null or (weven_percent_off > 0 and weven_percent_off <= 100));

alter table public.saas_checkout_offers
  add column if not exists applied_offer_type text
    check (
      applied_offer_type is null
      or applied_offer_type in (
        'founding_pct',
        'weven_pct',
        'group_pct',
        'founder_override'
      )
    );

alter table public.saas_checkout_offers
  add column if not exists white_glove_price_id text;

comment on column public.saas_checkout_offers.weven_declared is
  'Customer explicitly self-declared former Weven venue at Checkout.';
comment on column public.saas_checkout_offers.applied_offer_type is
  'Winning discount applied to the Stripe subscription (best-offer; never stacked).';

-- ---------------------------------------------------------------------------
-- Weven claims: verification workflow + audit history
-- ---------------------------------------------------------------------------
alter table public.weven_claims
  drop constraint if exists weven_claims_review_status_check;

alter table public.weven_claims
  add constraint weven_claims_review_status_check
  check (review_status in (
    'pending',
    'verified',
    'needs_review',
    'not_eligible',
    'rejected'
  ));

alter table public.weven_claims
  add column if not exists owner_email_normalized text;

alter table public.weven_claims
  add column if not exists venue_name_normalized text;

alter table public.weven_claims
  add column if not exists stripe_checkout_session_id text;

alter table public.weven_claims
  add column if not exists stripe_subscription_id text;

alter table public.weven_claims
  add column if not exists checkout_offer_id uuid
    references public.saas_checkout_offers (id) on delete set null;

alter table public.weven_claims
  add column if not exists applied_offer_type text
    check (
      applied_offer_type is null
      or applied_offer_type in (
        'founding_pct',
        'weven_pct',
        'group_pct',
        'founder_override'
      )
    );

alter table public.weven_claims
  add column if not exists applied_percent_off integer
    check (applied_percent_off is null or (applied_percent_off > 0 and applied_percent_off <= 100));

alter table public.weven_claims
  add column if not exists founding_also_earned boolean not null default false;

alter table public.weven_claims
  add column if not exists decision_history jsonb not null default '[]'::jsonb;

-- Idempotent claim creation from Checkout Session (retries / webhook replay).
create unique index if not exists weven_claims_session_uidx
  on public.weven_claims (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists weven_claims_subscription_idx
  on public.weven_claims (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on table public.weven_claims is
  'Trust-first former-Weven self-declaration + founder verification. Billing correction is a separate authorized action.';

-- ---------------------------------------------------------------------------
-- RLS / privileges (idempotent)
-- ---------------------------------------------------------------------------
alter table public.weven_claims enable row level security;
alter table public.saas_checkout_offers enable row level security;

revoke all on table public.weven_claims from authenticated, anon;
revoke all on table public.saas_checkout_offers from authenticated, anon;

grant all on table public.weven_claims to service_role;
grant all on table public.saas_checkout_offers to service_role;
