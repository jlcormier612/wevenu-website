# Venue Payment Processing (Stripe Connect Standard) — Architecture Assessment & Implementation Plan

**Sprint 4 — the final major launch initiative before Beta. Research and planning only — no implementation until this document and the open questions in §6 are approved.**

**Date:** 2026-07-21

This document supersedes `docs/stripe-payment-architecture.md` (2026-07-07) and `docs/stripe-launch-plan.md` (earlier today) as the authoritative plan — both are still accurate and are cited throughout rather than repeated in full. Nothing in either prior doc turned out to be wrong; this document exists to (a) restate the plan against this sprint's explicit framing (Connect Standard, Direct Charges, "Hello to Cheers is not the merchant of record"), (b) confirm scope boundaries precisely, and (c) carry the open decisions forward into a decision the user can approve.

---

## 1. Architectural principle, confirmed against the live codebase

Hello to Cheers is not the merchant of record. It never receives, holds, routes, or manages venue funds. Each venue connects its own Stripe account; money flows Couple → Stripe Checkout → Venue's Stripe account → Venue's bank account. Hello to Cheers only ever receives webhook events, and reacts to them.

This is not a new decision — it's already what exists today, confirmed line-by-line:

- **Connect account type is already Standard** (`app/api/stripe/callback/route.ts` exchanges an OAuth `code` for a `stripe_user_id` — that's a Standard-Connect account-linking flow, not Express or Custom onboarding).
- **No column, table, or code path anywhere holds venue funds.** The only Stripe-related state that exists is `venues.stripe_account_id`/`stripe_charges_enabled`/`stripe_onboarding_status` (account linkage only) and a `stripe` literal in `lib/payments/constants.ts`'s manual-entry payment-method list (metadata only, no API call behind it).
- **Direct Charges** (not Destination Charges) is the confirmed charge model from the prior architecture doc, and is the only model consistent with "Wevenu never touches funds" — a Direct Charge is created directly on the connected account; Wevenu's own Stripe account is never in the money's path at all, not even transiently.

## 2. Scope confirmation

**In scope**, matching the existing Booking Financial Architecture's own entity model — nothing here introduces a new financial concept, only a new way an existing one (`payment_line_items.status → 'paid'`) gets set:

- Stripe Connect Standard onboarding (restoring the "coming soon" button — see §3)
- Connection status, disconnect, reconnect
- Hosted Checkout (confirmed direction, see §4.1) for deposits and payment-schedule installments
- Webhook processing: payment success, failure, cancellation
- Reconciliation, refunds
- The existing payment schedule, Conversations, QuickBooks sync, and audit-log hooks — reusing the exact functions that already fire for a manually-recorded payment

**Explicitly out of scope**, confirmed against the live codebase so this isn't just a restated intention:

- **Hello to Cheers subscription billing** — this is `marketing/`, a fully separate Next.js workspace with its own `package.json` (`stripe` v22.3.1 already installed there) and its own Stripe integration (`marketing/app/api/stripe/{checkout,webhook,portal,payment-link}/route.ts`). Confirmed zero code sharing with the main app today; this plan does not touch that workspace.
- Stripe Express, Stripe Custom, escrow, holding customer funds, marketplace payouts, general ledger, accounting, tax engine, product-catalog sync — none of these exist anywhere in the codebase today, and nothing in this plan introduces them.

## 3. What exists today

Full detail already captured in `docs/stripe-launch-plan.md` §1 (verified this session against live code) — condensed here:

| Piece | State |
|---|---|
| Invoices, payment schedules, balance calculation | Complete, correct, unchanged by this plan. `reconcileInvoiceBalance()` (`lib/payments/repository.ts`) is the single function that keeps `invoices.balance_due` correct — this is what a webhook handler calls, not new balance logic. |
| `markLineItemPaid()` / `refundLineItem_()` (`lib/payments/service.ts`) | The two functions that mutate payment state today, both manual-entry only. Both already enqueue a QuickBooks sync as a side effect. A webhook handler should call into these directly, not duplicate their logic. |
| Stripe OAuth callback (`app/api/stripe/callback/route.ts`) | Real, working account-linking. Two confirmed live gaps: no `state` CSRF check (unlike the QuickBooks callback, which does check), and `connectStripeAccount()` sets `charges_enabled: true` unconditionally without reading Stripe's own flag. |
| Stripe Connect button (`components/settings/stripe-connect-section.tsx`) | Deliberately removed (TR-M1, "honestly absent, not misleading"). Card is hardcoded "Coming soon." Restoring this button is genuinely part of this sprint's scope, not a separate task. |
| Stripe webhooks | **None exist.** No route, no signature verification, nothing. Confirmed by direct search. This is the single largest missing piece. |
| Stripe Customer object | Does not exist. No `stripe_customer_id` anywhere. Open decision, §6. |
| Disconnect | `disconnectStripeAccount()` only clears local columns — never calls Stripe's own deauthorize endpoint. Live gap; QuickBooks's disconnect (which does call Intuit's revoke endpoint first) is the pattern to match. |
| `stripe` npm package | Not installed in the main app (`package.json`). Already installed in the separate `marketing/` workspace for the unrelated System A integration — the idiom exists in-repo, just not in this workspace. |

## 4. Design decisions

### 4.1 Hosted Checkout (confirmed direction, overriding the prior doc's Payment Element recommendation)

The original architecture doc recommended an embedded Payment Element to keep the couple inside the portal. That recommendation is superseded — **Hosted Checkout is the approved direction**, per this sprint's explicit brief. Both are equally sound under Direct Charges/Standard Connect; Hosted Checkout trades some portal cohesion for materially less build effort (server creates a Checkout Session, redirects, Stripe owns the entire payment UI, including 3-D Secure and any future payment-method additions with no extra Wevenu code).

### 4.2 Webhook architecture

New route, e.g. `app/api/webhooks/stripe-connect/route.ts`, registered as a **Connect** webhook endpoint (receives events from every connected account, not Wevenu's own account — this is the mechanism by which Wevenu learns what happened in a venue's own Stripe account without ever touching the money itself). Structural idiom to follow (matching the existing Facebook webhook route): read the raw body via `request.text()` before any parsing, verify, then dispatch. Verification itself uses Stripe's own SDK (`stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`), not hand-rolled HMAC. The event's `account` field maps back to `venues.stripe_account_id` to resolve which venue it belongs to.

Handles: `checkout.session.completed` (success for card; for ACH this fires when the couple submits their bank details, not when funds actually settle — see below), `payment_intent.processing` (ACH only — bank debit initiated, funds not yet landed), `payment_intent.payment_failed` (failure — includes a later-failing ACH debit, e.g. insufficient funds, not just an immediate card decline), `charge.refunded` (refund confirmation). Checkout Session expiry (24h default) covers cancellation/abandonment — no explicit action needed beyond leaving the `payment_line_item` in its existing `pending` status; nothing currently modeled needs a new state for "cancelled" distinct from "never completed."

### 4.3 Idempotency & retry strategy

Two distinct mechanisms, matching the QuickBooks precedent exactly rather than inventing a new pattern:

- **Webhook delivery idempotency** (Stripe redelivers events on a non-2xx response, and can rarely deliver the same event twice even on success): a unique constraint on `payment_line_items.stripe_payment_intent_id` (mirroring `quickbooks_customer_id`'s partial unique index) plus a check-before-write in the handler — a second delivery of `checkout.session.completed` for an already-`paid` line item is a no-op, not an error, and still returns 200 (Stripe stops retrying on any 2xx).
- **Our own outbound calls to Stripe** (creating a Checkout Session, issuing a refund): these are synchronous, user-initiated actions (a coordinator clicking "Refund," a couple clicking "Pay"), not a background queue — they don't need the QuickBooks-style retry-with-backoff queue, since a failed synchronous call surfaces immediately to the person who triggered it and they can just try again. The QuickBooks queue pattern exists because QuickBooks syncs are fire-and-forget background side effects with no one watching; Stripe's collection actions are the opposite — someone is always watching in real time.

### 4.4 Failure recovery

- **Checkout Session creation fails** (e.g. venue's Stripe account is disconnected/restricted): surfaced synchronously to the couple in the portal, no payment attempted, no retry queue needed.
- **Webhook processing itself fails** (e.g. a transient DB error while calling `markLineItemPaid`): return a non-2xx so Stripe's own retry schedule (up to 3 days, exponential backoff, built into Stripe Connect webhooks) handles it — no separate retry queue needed on Wevenu's side, since Stripe already provides one. This is a real, deliberate difference from the QuickBooks integration, where Wevenu owns the retry queue because there's no equivalent from Intuit's side for a push-sync-on-our-own-schedule model.
- **Refund API call fails**: surfaced synchronously to the coordinator (Owner-only action per TR-M3), no optimistic local state change before Stripe confirms.

### 4.5 Disconnect / reconnect

Disconnect: call Stripe's real `POST /oauth/deauthorize` (best-effort, wrapped in try/catch) before clearing local `venues` columns — exact mirror of `disconnectQuickBooksAccount()`. Reconnect: re-running the same OAuth flow; add the `state`-based CSRF check the QuickBooks callback already has and the Stripe callback currently lacks.

### 4.6 Composition with QuickBooks

No conflict. A Stripe-confirmed payment or refund still calls `enqueueQuickBooksSync(venueId, "payment"/"refund", ...)` exactly as a manually-recorded one does today — `markLineItemPaid`/`refundLineItem_` already do this as an existing side effect, so calling into them from the webhook handler gets QuickBooks sync "for free," no new integration code needed at that boundary.

## 5. Data model additions (minimal, additive — nothing existing is redesigned)

Following the exact idiom the QuickBooks migration established (RLS + explicit `grant ... to authenticated` **and** `to service_role` in the same migration file — the webhook handler runs under `createAdminClient()`, no user session, and QuickBooks's rollout hit this exact gap twice before catching it):

- `payment_line_items`: `stripe_payment_intent_id text`, `stripe_checkout_session_id text`, `stripe_payment_method_type text` (`card`/`us_bank_account`). `status` check constraint gains one new value, `'processing'` — inserted between `'pending'` and `'paid'` — used only for an ACH debit that's been initiated but hasn't settled yet; card payments go straight `pending → paid` and never pass through it. Unique partial index on `stripe_payment_intent_id where ... is not null`.
- `invoices`: none needed — Stripe payments settle against `payment_line_items`, same as every other payment method; `reconcileInvoiceBalance()` already aggregates from there regardless of method.
- `venues`: `stripe_charges_enabled_verified_at timestamptz` (records when `charges_enabled` was last actually confirmed against Stripe's API, closing the "unconditionally true" gap in §3), `stripe_accepted_payment_methods text[] not null default '{card}'` with a check constraint on allowed array elements (§6 Q3 — "Accepted payment methods," not a single ACH boolean).
- `clients.stripe_customer_id text` — confirmed, §6 Q1. Created/reused on first checkout, not eagerly on connect.

No new tables required for the core flow (unlike QuickBooks, which needed a dedicated connection table for rotating OAuth tokens) — Stripe Connect Standard never hands Wevenu a refresh token to manage; `venues.stripe_account_id` is sufficient connection state, confirmed correct in the original architecture doc and unchanged by this pass.

## 6. Decisions (approved 2026-07-21)

1. **Stripe Customer object: persisted.** `clients.stripe_customer_id`, created or reused on the client's first Checkout Session, not eagerly created on account connect. Enables Stripe's saved-payment-method convenience across a multi-installment schedule.
2. **Application fee: none.** Pure facilitation — Wevenu takes no percentage of venue↔couple payments. `application_fee_amount` is never set on any Checkout Session. Revenue stays entirely in the separate, out-of-scope subscription-billing system.
3. **Payment methods: card + ACH, built together, not phased.** Confirmed 2026-07-22: this is not "adding a second processor" — it's one venue-level payment-methods setting, one additional lifecycle state (`processing`), and webhook handling for delayed settlement. The rest of the pipeline (Hosted Checkout, Stripe Customer, invoice, payment schedule, webhook route, QuickBooks sync, Conversations, audit history) is identical for both methods; the existing single pipeline is taught that not every payment settles immediately, not duplicated.
   - **Modeled as "Accepted payment methods," not an "ACH enabled" boolean** — `venues.stripe_accepted_payment_methods text[] not null default '{card}'`, a small allowed-value check (`card`, `us_bank_account` today), not a single-purpose flag. Scales to any future Stripe-supported method (e.g. `link`, `cashapp`) as an allowed-values addition, never a schema change. Settings UI: a checkbox list ("☑ Credit/Debit Card," "☐ ACH Bank Transfer"), not a single toggle.
   - **Implementation rule, non-negotiable**: an invoice is never marked `paid` until Stripe confirms the payment actually succeeded. `payment_line_items.status` gains exactly one new value, `processing`, sitting between `pending` and `paid`:
     - Card: `pending → paid` (immediate, unchanged from today's mental model).
     - ACH: `pending → processing` (Checkout completed, debit initiated, funds not yet landed) `→ paid` (settlement webhook) or `→ pending` (failure webhook — e.g. insufficient funds; back to pending because nothing was actually collected, not a terminal `failed` state, since the couple can simply retry).
   - This is the one piece of the build with no direct precedent elsewhere in the codebase — everything else in this plan has a QuickBooks-integration analog to copy from.
4. **Receipts: Hello to Cheers-branded, delivered through Conversations, alongside Stripe's own automatic receipt as a redundant processor-level confirmation.** Reuses the existing invoice-print infrastructure as the template. Confirmed required content: payment amount, invoice reference, remaining balance, next payment due (when the schedule has one), permanently recorded in Conversation history (not a transient toast/notification).

## 7. Implementation plan

1. **Environment & dependencies.** Add `stripe` npm package to the main app (already a known-good version in `marketing/package.json`, reuse the same major version). New env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_CLIENT_ID` (OAuth authorize URL, mirrors QuickBooks's `NEXT_PUBLIC_QUICKBOOKS_CLIENT_ID` pattern).
2. **Migration** (one file, following the QuickBooks-era idiom exactly — RLS/GRANT for every touched table in the same file): the `payment_line_items`/`venues`/`clients` column additions from §5, the `status` enum addition (`processing`), `venues.stripe_accepted_payment_methods`. No new tables.
3. **Fix the two confirmed OAuth gaps**: add `state`-based CSRF verification to `app/api/stripe/callback/route.ts` (mirroring the QuickBooks callback), and make `connectStripeAccount()` read the connected account's real `charges_enabled` flag (a `GET /v1/accounts/{id}` call) instead of assuming `true`.
4. **Real disconnect**: `disconnectStripeAccount()` calls Stripe's `POST /oauth/deauthorize` first (best-effort), then clears local state regardless of outcome — mirrors `disconnectQuickBooksAccount()`.
5. **Restore the Connect button** in `components/settings/stripe-connect-section.tsx` — real connect flow, live status badges (connected / charges not yet enabled / reconnect required / not connected), remove the "Coming soon" copy. Add an "Accepted payment methods" checklist (Card / ACH Bank Transfer) to this same settings surface, backed by `stripe_accepted_payment_methods`.
6. **Checkout Session creation** — new server action, one Session per `payment_line_item`, `payment_method_types` driven by the venue's `stripe_accepted_payment_methods` array, scoped to the connected account for a Direct Charge, creating/reusing a `clients.stripe_customer_id` first.
7. **Webhook route** (`app/api/webhooks/stripe-connect/route.ts`) — signature verification, event dispatch per §4.2, idempotency check-before-write, calls into `markLineItemPaid`/`reconcileInvoiceBalance`/`refundLineItem_` rather than duplicating their logic. `payment_intent.processing` moves a line item to the new `processing` status without marking the invoice paid; only a genuine settlement webhook does that.
8. **Conversation message + branded receipt** — inserted from the webhook handler on `checkout.session.completed` (and on failure, a distinct system message), reusing invoice-print infrastructure for the receipt document.
9. **Refunds** — `refundLineItem_()` gains a branch: real `stripe.refunds.create` call when `stripe_payment_intent_id` is present (still Owner-only), existing ledger-only path otherwise; the `charge.refunded` webhook finalizes the state rather than an optimistic UI update.
10. **Couple-portal checkout entry point** — wherever the couple currently sees "pay now" (payment schedule view in the portal), wire the button to create a Checkout Session and redirect, with success/cancel return routes back into the portal.

## 8. Verification plan

Same posture as the QuickBooks work: everything not requiring a live Stripe round-trip gets built and verified now (webhook signature verification against a locally-signed test payload, idempotency behavior, the Conversation-message insert, the receipt-generation code path); the live round-trip items are verified the moment test-mode credentials exist.

1. OAuth: real test-mode connect, `state` mismatch correctly rejected, `charges_enabled` read and stored accurately.
2. Checkout: real test-mode Session, Stripe's test cards (success, decline) and test bank-account numbers (ACH success, ACH failure), correct redirect-back in both success and cancel paths.
3. Webhook: signature verification rejects a tampered payload and accepts a genuine one; `checkout.session.completed` / `payment_intent.processing` / `payment_intent.payment_failed` / `charge.refunded` each correctly drive `payment_line_items.status` and `invoices.balance_due`.
4. Idempotency: replay the same webhook event twice, confirm no duplicate payment recorded.
5. Conversation + receipt: message appears in the correct Conversation with the confirmed required fields; receipt document generates correctly.
6. Refund: real test-mode refund, confirm the API call fires and `charge.refunded` finalizes the ledger (not an optimistic pre-confirmation update).
7. Disconnect: confirm Stripe's own dashboard shows the connection actually revoked.
8. QuickBooks composition: a Stripe-confirmed payment/refund still enqueues and completes a QuickBooks sync exactly as a manual one does.
9. Standard `tsc --noEmit` / `next build` clean pass throughout.
