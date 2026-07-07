# Payment Architecture — Two Systems, Not One

**Status:** Design proposal — not yet implemented. This is the "design it completely before writing code" pass for TR-M1's permanent fix, per your instruction.
**Date:** 2026-07-07
**Resolves (once built):** `docs/trust-risk-register.md` TR-M1's permanent fix — real payment collection between a couple and a venue. Does **not** cover Wevenu's own SaaS billing (see "Out of scope" below).

---

## The two systems, and why they must never share code paths

**System A — Wevenu Billing.** Venues pay *us* a monthly/annual subscription. Wevenu is the merchant of record. This runs on Wevenu's own Stripe account (Stripe Billing/Subscriptions), managed from Wevenu HQ. **Out of scope for this document** — a separate workstream, structurally similar to what you built for QuickCloud, but with its own design pass when it's prioritized.

**System B — Venue Client Payments.** Couples pay *their venue* — a deposit, an installment, a balance. This is TR-M1's permanent fix, and it's the entire subject of this document. The one non-negotiable constraint you stated: **Wevenu facilitates; it never receives or holds a couple's money.** Every decision below is chosen specifically because it satisfies that constraint, not just because it's the easiest Stripe integration path.

Keeping these two systems structurally separate — different Stripe accounts, different code paths, different data tables, ideally never imported from one another — is itself a safeguard. A bug or a bad assumption in Wevenu Billing should never be able to touch a couple's payment, and vice versa. Recommend this separation be enforced by convention (`lib/billing/*` for System A when it's built, `lib/payments/*` stays exclusively System B) and called out in a code-review checklist item once System A exists.

---

## System B architecture

### 1. Connect account type: keep Standard (already chosen, correctly)

The existing OAuth flow (`app/api/stripe/callback/route.ts`) already uses `connect.stripe.com/oauth/authorize` — that's a **Standard** connected account, and it's the right choice here, more so than Express or Custom:

- A Standard account is the venue's own, fully independent Stripe account. The venue has their own Stripe dashboard, their own login, their own relationship with Stripe for compliance/KYC, their own payout schedule and bank account on file.
- Wevenu never onboards the venue's identity/compliance data (no SSN, no bank account details ever touch Wevenu's servers or database) — Stripe collects and owns all of that directly with the venue.
- This is the strongest version of "Wevenu facilitates, never touches funds": the connected account isn't a sub-account Wevenu manages on the venue's behalf (that's what Express/Custom are for) — it's genuinely the venue's own account, with Wevenu just given API permission to create charges on it.

**Recommendation: no change needed here.** The existing Connect flow doesn't need to be rebuilt, only extended (see gap below).

**One gap in the existing flow worth closing alongside this work:** `connectStripeAccount()` (`lib/venue/service.ts:311`) sets `stripe_charges_enabled: true` unconditionally the moment the OAuth exchange succeeds — it never actually checks Stripe's own `charges_enabled` flag on the connected account. A venue can complete OAuth before finishing Stripe's own KYC requirements, in which case charges will fail even though Wevenu's database says `charges_enabled: true`. Fix: call `stripe.accounts.retrieve(stripeAccountId)` right after the OAuth exchange and store the real `charges_enabled`/`payouts_enabled` values; re-check periodically (or on a webhook, see below) since a venue can lose `charges_enabled` later (e.g., a compliance flag from Stripe).

### 2. Charge type: Direct Charges, not Destination Charges

This is the single most important decision for the "never hold funds" constraint, so it's worth spelling out the alternatives Stripe offers and why one is right for Wevenu:

| Model | Where the charge object lives | Where funds land | Wevenu's role |
|---|---|---|---|
| **Direct Charge** (recommended) | On the connected account | Directly in the venue's Stripe balance | Creates the charge *as* the connected account (via the `Stripe-Account` header), optionally attaches `application_fee_amount` if Wevenu ever wants a cut — collected automatically by Stripe, no separate transfer step |
| Destination Charge | On the platform account | Platform balance first, then transferred to the connected account | Platform account is a party to every transaction — money touches Wevenu's Stripe balance, even if only momentarily |
| Separate Charges & Transfers | On the platform account, transferred manually | Platform balance first, transferred by Wevenu's code | Same issue as above, plus Wevenu's code becomes responsible for correctly moving money — more surface area for a transfer bug to strand funds |

**Recommendation: Direct Charges, full stop.** It's both the architecturally correct choice for your stated constraint and the simplest to build — no transfer logic, no reconciliation between platform and connected balances, nothing in Wevenu's own Stripe balance ever represents a couple's money.

### 3. Collection UI: embedded Payment Element, not a redirect to Stripe Checkout

The couple already has a payments view in the portal (`components/portal/payment-section.tsx`, `/api/portal/payments`) — read-only today. Two ways to make it collect money:

- **Stripe Checkout** (hosted page): fastest to build, but redirects the couple off Wevenu entirely for the payment step — feels like "leaving the app," which cuts against the polished, cohesive portal experience this whole trust-rebuilding effort is about.
- **Stripe Payment Element** (embedded): more building (a client-side Stripe.js integration inside `payment-section.tsx`), but the couple never leaves the portal. Recommend this.

Payment Element supports Direct Charges on connected accounts natively (create the PaymentIntent scoped to the connected account, pass its `client_secret` to the embedded Payment Element client-side). No architectural conflict with the Direct Charge decision above.

**Recommendation: one PaymentIntent per payment_line_item**, created on-demand when the couple clicks "Pay" on a specific due installment — not one big upfront PaymentIntent for the whole schedule. This matches the existing schedule/line-item data model exactly (one line item = one due amount = one charge) and means a partial-schedule payment never has to be split after the fact.

### 4. Data model additions

Minimal, additive, on the existing tables — no restructuring of the payment_schedules/payment_line_items model built for manual tracking:

```sql
alter table payment_line_items
  add column stripe_payment_intent_id text,
  add column stripe_charge_id text;

alter table venues
  add column stripe_charges_enabled_verified_at timestamptz; -- last time we confirmed real Stripe status, not just our own flag
```

`paymentMethod = 'stripe'` already exists as an option in `PAYMENT_METHODS` (`lib/payments/constants.ts`) — it's currently selectable on a *manual* "mark as paid" entry (a coordinator recording a Stripe payment that happened outside the app, e.g. over the phone via a Stripe Payment Link). Once real collection ships, `paymentMethod === 'stripe'` **and** `stripe_payment_intent_id` present together mean "this went through the real integration" — that combination is what should gate whether a refund (see below) calls the real Stripe API or just updates our own ledger, the way TR-M3's manual refund flow already does for cash/check/etc.

### 5. Webhooks — Connect events, verified, idempotent

A new route, e.g. `app/api/webhooks/stripe-connect/route.ts`, configured in the Stripe Dashboard as a **Connect webhook endpoint** (receives events from every connected account, not just the platform account). Required handling:

- **Signature verification is mandatory** — `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`. Never trust an unverified payload; this is the one place a forged request could fake a "payment succeeded" state.
- **Events to handle:** `payment_intent.succeeded` (mark the line item paid, run the same `reconcileInvoiceBalance` path `markLineItemPaid` already uses — no new balance logic needed), `payment_intent.payment_failed` (surface the failure to the coordinator, don't silently leave it pending), `charge.refunded` (if a refund was issued directly from the venue's own Stripe dashboard rather than through Wevenu, reconcile our ledger to match — otherwise our records would silently diverge from Stripe's, the exact class of bug the Trust Risk Register exists to catch).
- **Idempotency:** store `stripe_payment_intent_id` as a unique constraint on `payment_line_items` (or check-before-write in the webhook handler) so a duplicate webhook delivery (Stripe explicitly documents these as possible and expected) can't double-process a payment.
- **Account identification:** every Connect webhook event carries an `account` field identifying which connected account it came from — map that back to `venues.stripe_account_id` to find the right venue before touching any row.

### 6. Refunds — route through the real API when the payment was real

TR-M3 (shipped this session) already gives every payment a refund/void path, but it's ledger-only — correct for a manually-recorded cash/check/Venmo payment, but insufficient once a payment actually went through Stripe: the money needs to actually move back to the couple's card, not just have its status flipped in Wevenu's database.

`refundLineItem_` (`lib/payments/service.ts`) should branch: if `stripe_payment_intent_id` is present, call `stripe.refunds.create({ payment_intent: id }, { stripeAccount: venue.stripeAccountId })` (still Owner-only, still the same amount-validation and activity-logging TR-M3 already built) and let the `charge.refunded` webhook above confirm and finalize the ledger update — don't optimistically mark it refunded before Stripe confirms. If no `stripe_payment_intent_id`, fall back to exactly what TR-M3 already does today (ledger-only). This means TR-M3's work doesn't get rebuilt, only extended with one conditional branch.

### 7. Failure/decline handling

Payment Element surfaces card-decline errors directly to the couple in real time (Stripe's own UI does this natively) — no custom failure UI needed for the common case. The one thing to build: if `payment_intent.payment_failed` fires after the couple has already left the page (e.g., a delayed bank-decline on some payment methods), the coordinator needs to see it — a notification via the existing `notification_log`/Wevenu HQ System Health pattern (already used for the TR-B2 tour-email fix) is the natural fit, not a new mechanism.

---

## Open questions for you before implementation starts

1. **Application fee.** Do you want Wevenu to take a transaction fee/percentage on venue client payments (a real revenue line), or is Wevenu Billing (System A) the only place Wevenu makes money? This changes nothing architecturally (Direct Charges support `application_fee_amount` either way) but changes what gets built in the checkout flow and in venue-facing pricing communication.
2. **Payment methods beyond card.** Stripe Payment Element can support ACH/bank debit alongside cards with very little extra work (same Element, different payment method types enabled). Worth including at launch, or card-only for v1?
3. **Partial/custom amounts.** Should a couple be able to pay more than the specific due line item shown (e.g., pay off the whole remaining balance in one go), or strictly one PaymentIntent per scheduled installment as designed above?

None of these block starting the build — they're scoping decisions that change small pieces of the checkout UI, not the underlying architecture above.

## What this needs before it can be built and verified

A real Stripe account in test mode, with:
- `STRIPE_SECRET_KEY` (platform account's secret key — used to create Direct Charges on connected accounts via the `Stripe-Account` header)
- `STRIPE_PUBLISHABLE_KEY` (for the client-side Payment Element)
- `STRIPE_WEBHOOK_SECRET` (for the new Connect webhook endpoint)
- The `stripe` npm package (not currently installed)

Once those exist, this document is the implementation spec — happy to start building the moment you confirm the three open questions above (or tell me to use sensible defaults: no application fee initially, card-only, one PaymentIntent per line item).
