-- ============================================================================
-- Venue Payment Processing (Stripe Connect Standard) — Phase A: schema.
--
-- Sprint 4 launch requirement. Hello to Cheers is never the merchant of
-- record — it never receives, holds, routes, or manages venue funds. Each
-- venue connects its own Stripe account (Standard Connect, already how
-- app/api/stripe/callback/route.ts works); money moves Couple -> Stripe
-- Checkout -> Venue's Stripe account -> Venue's bank account. Wevenu only
-- ever reacts to webhook events.
--
-- This does NOT redesign invoices, payment schedules, balance calculation,
-- or QuickBooks sync — those are considered complete and correct
-- (docs/booking-financial-architecture.md). Stripe plugs into the existing
-- payment_line_items lifecycle; the additions below teach that one existing
-- pipeline that not every payment settles immediately (ACH), rather than
-- building a second pipeline.
--
-- Every table/column below gets RLS AND the explicit GRANT in this same
-- file, including service_role (the webhook route runs under
-- createAdminClient(), no user session) — this codebase's migration
-- history has repeatedly shipped RLS without the matching grant, most
-- recently caught twice during the QuickBooks integration
-- (20261127000000, 20261128000000). Not repeating that a third time.
-- ============================================================================

-- ── payment_line_items — Stripe identifiers + the new "processing" state ───
-- Card payments confirm near-instantly (pending -> paid). ACH bank debits
-- take 4-5 business days to settle: Hosted Checkout completing only means
-- the debit was *initiated*, not that funds landed. "processing" sits
-- between pending and paid so an invoice is never marked paid until Stripe
-- actually confirms the money moved. A failed ACH debit returns to
-- 'pending' (nothing was actually collected — the couple can just retry),
-- not a terminal failure state.

alter table public.payment_line_items drop constraint payment_line_items_status_check;

alter table public.payment_line_items add constraint payment_line_items_status_check
  check (status = any (array['pending', 'processing', 'overdue', 'paid', 'cancelled', 'partially_refunded', 'refunded']));

alter table public.payment_line_items
  add column stripe_payment_intent_id     text,
  add column stripe_checkout_session_id   text,
  add column stripe_payment_method_type   text check (stripe_payment_method_type in ('card', 'us_bank_account'));

create unique index payment_line_items_stripe_payment_intent_id
  on public.payment_line_items (venue_id, stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- ── clients — Stripe Customer, created/reused on first checkout ────────────
-- Not eagerly created on account connect. Enables saved-payment-method
-- convenience across a multi-installment payment schedule.

alter table public.clients
  add column stripe_customer_id text;

create unique index clients_stripe_customer_id
  on public.clients (venue_id, stripe_customer_id) where stripe_customer_id is not null;

-- ── venues — real charges_enabled verification + accepted payment methods ──
-- connectStripeAccount() previously set stripe_charges_enabled: true
-- unconditionally the moment OAuth succeeded, never reading Stripe's own
-- flag. stripe_charges_enabled_verified_at records when it was last
-- actually confirmed against the Stripe API.
--
-- stripe_accepted_payment_methods is modeled as "Accepted payment methods"
-- (an array a venue checks/unchecks in Settings), not a single-purpose
-- "ACH enabled" boolean — this scales to any future Stripe-supported method
-- as an allowed-values addition, never a schema change.

alter table public.venues
  add column stripe_charges_enabled_verified_at timestamptz,
  add column stripe_accepted_payment_methods text[] not null default array['card'];

alter table public.venues add constraint venues_stripe_accepted_payment_methods_check
  check (stripe_accepted_payment_methods <@ array['card', 'us_bank_account']::text[]
    and array_length(stripe_accepted_payment_methods, 1) > 0);

-- ── stripe_webhook_events — idempotency gate for the whole webhook route ───
-- Stripe redelivers events on a non-2xx response and can rarely deliver the
-- same event twice even after a 2xx. Insert-first on the unique Stripe
-- event id is the idempotency gate for the entire handler (not just the
-- balance update) — a duplicate delivery hits the unique-violation branch,
-- returns 200 immediately, and never re-runs the Conversation-message or
-- receipt side effects a second time. Append-only, mirrors
-- quickbooks_sync_log's audit-trail shape.

create table public.stripe_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  stripe_event_id  text not null unique,
  event_type       text not null,
  venue_id         uuid references public.venues (id) on delete set null,
  processed_at     timestamptz not null default now()
);

create index stripe_webhook_events_venue on public.stripe_webhook_events (venue_id, processed_at desc);

alter table public.stripe_webhook_events enable row level security;
create policy stripe_webhook_events_all on public.stripe_webhook_events
  for all using (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- service_role only — this table exists purely for the webhook handler
-- (createAdminClient(), no user session); no venue-facing UI reads it today.
grant select, insert on public.stripe_webhook_events to service_role;

-- ── Missing service_role grants on pre-existing tables ──────────────────────
-- Found the same way the two QuickBooks follow-up grant migrations were:
-- checked directly, not assumed. markLineItemPaid()/refundLineItem_() (the
-- exact functions the webhook handler calls into) insert into
-- payment_activities always, and luv_celebrations conditionally — neither
-- table has ever granted service_role anything. Both calls would silently
-- no-op or fail the moment they ran from the webhook's admin client instead
-- of an authenticated coordinator session, since rolbypassrls does not
-- imply a table GRANT.

grant select, insert on public.payment_activities to service_role;
grant select, insert on public.luv_celebrations   to service_role;

notify pgrst, 'reload schema';
