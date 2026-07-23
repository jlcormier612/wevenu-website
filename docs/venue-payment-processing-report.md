# Venue Payment Processing (Stripe Connect Standard) — Final Report

**Sprint 4 — the final major launch initiative before Beta.** Companion to `docs/venue-payment-processing-architecture.md` (assessment, plan, decisions). This report covers what was actually built, what was verified and how, and what's still blocked on real credentials.

**Date:** 2026-07-22

---

## Summary

Card + ACH built together as one payment pipeline, per the approved decision — not two processors, one pipeline that now understands that not every payment settles immediately. Hello to Cheers still never touches venue funds: every charge is a Direct Charge created on the venue's own connected Stripe account; Wevenu's role is entirely webhook-reactive.

Everything that doesn't require a live Stripe round-trip has been built and verified against the real local database and the real Stripe SDK's signature-verification logic. The pieces that genuinely need live Stripe test-mode credentials (an actual OAuth connect, an actual Checkout Session completing, an actual webhook delivered by Stripe) are flagged below, same posture as the QuickBooks integration's own launch report.

## What was built

**Schema** (`supabase/migrations/20261135000000_stripe_payment_processing_phase_a.sql`, `20261136000000_stripe_portal_checkout_context.sql`):
- `payment_line_items`: `stripe_payment_intent_id`, `stripe_checkout_session_id`, `stripe_payment_method_type`, and a new `status` value, `processing` (ACH initiated, not yet settled — an invoice is never marked paid before this resolves to `paid`).
- `venues`: `stripe_charges_enabled_verified_at`, `stripe_accepted_payment_methods text[]` (the "Accepted payment methods" checklist, not a single ACH boolean — scales to future Stripe payment methods as an allowed-values addition).
- `clients`: `stripe_customer_id`.
- New table `stripe_webhook_events` — the idempotency gate for the entire webhook handler, keyed on Stripe's own event id.
- New RPC `get_portal_checkout_context(token, item_id)` — the couple portal's token-validated read into a payable item before a Checkout Session is created; mirrors `get_portal_payments()`'s shape exactly.
- RLS + explicit `grant ... to authenticated`/`to service_role` on every new table, in the same migration file. Two pre-existing tables (`payment_activities`, `luv_celebrations`) were missing a `service_role` grant entirely — found by direct inspection before it could bite in production, the same way two QuickBooks follow-up migrations had to catch it live; fixed in the same migration rather than as a third follow-up.

**Connect account lifecycle** (`lib/stripe/service.ts`, `app/api/stripe/callback/route.ts`, `components/settings/stripe-connect-section.tsx`):
- Restored the "Connect with Stripe" button — no longer "coming soon" (TR-M1's placeholder is retired now that there's something real behind it).
- `connectStripeAccount()` now reads the connected account's real `charges_enabled` flag from Stripe instead of assuming `true`.
- `disconnectStripeAccount()` now calls Stripe's own `/oauth/deauthorize` endpoint before clearing local state (best-effort; local state always clears regardless of revoke outcome).
- The OAuth callback now verifies `state` against the actual session's venue — this genuinely had no CSRF check before this sprint (unlike the QuickBooks callback, which always has).
- "Accepted payment methods" checklist (Card / ACH Bank Transfer) in the same Settings card, backed by `stripe_accepted_payment_methods`.

**Checkout** (`lib/stripe/customer.ts`, `lib/stripe/checkout.ts`, `app/api/portal/checkout/route.ts`, `components/portal/payment-section.tsx`):
- A Stripe Customer is created/reused per client on their first checkout (idempotent by email lookup on the connected account first).
- One Hosted Checkout Session per `payment_line_item`, `payment_method_types` driven by the venue's accepted-methods setting, created directly on the connected account (the Direct Charge equivalent for Checkout).
- A "Pay now" button on any pending/overdue item in the couple portal's payment timeline; success/cancel redirects show an inline confirmation banner back in the portal.

**Webhook processing** (`app/api/webhooks/stripe-connect/route.ts`, `lib/stripe/webhook-handlers.ts`):
- One implementation refinement worth flagging explicitly: the architecture doc had sketched `checkout.session.completed` as the primary event. Building it, `payment_intent.*` events turned out to be the cleaner design — a single, unified signal for both card (near-instant) and ACH (settles days later) without needing to branch on `payment_status`. Metadata is copied onto the PaymentIntent at Session-creation time (`payment_intent_data.metadata`) so this works without an extra lookup. `checkout.session.completed` is no longer separately handled for balance mutations.
- `payment_intent.succeeded` → the one canonical "funds are guaranteed" signal for both payment methods. Calls the same repository functions a coordinator's manual "Mark Paid" click uses (`markItemPaidFromStripe`, `insertPaymentActivity`, `reconcileInvoiceBalance`, `enqueueQuickBooksSync`, `triggerAutoComplete`, the final-payment Luv celebration), plus one new step neither manual path has: a Conversation receipt message.
- `payment_intent.processing` → ACH only, moves the item to `processing`.
- `payment_intent.payment_failed` → reverts `processing` back to `pending` (nothing was actually collected) and posts a system Conversation message explaining what happened.
- `charge.refunded` → idempotent, defensive confirmation (the primary refund trigger is the synchronous API call below; this catches a refund issued directly in Stripe's own dashboard, so the ledger doesn't silently drift).
- Idempotency: insert-first on the Stripe event id, unique-constraint gated. A duplicate delivery returns 200 immediately without re-running any side effect. A genuinely failed attempt deletes its own idempotency row before returning non-2xx, so Stripe's real retry isn't swallowed as a false duplicate — caught and fixed during implementation, not shipped as a bug (see Verification below).
- No new retry queue: a webhook processing failure returns non-2xx and lets Stripe's own retry schedule (up to 3 days, built into Connect webhooks) handle it — deliberately different from the QuickBooks integration, which owns its own retry queue because there's no equivalent from Intuit's side.

**Refunds** (`lib/payments/service.ts`, `lib/stripe/refunds.ts`):
- `refundLineItem_()` now checks for `stripe_payment_intent_id` first. If present, calls Stripe's real refund API (still Owner-only, per TR-M3) before touching the local ledger — no optimistic state change ahead of Stripe's confirmation. If absent (a manually-recorded payment that never went through Stripe), the original TR-M3 ledger-only path is untouched.

**Receipts / Conversations** (`lib/stripe/notify.ts`):
- A Hello to Cheers-branded system message is posted to the client's Conversation on every successful payment and every failed one. Required fields confirmed present: payment amount, payment method, invoice reference, remaining balance (or "paid in full"), next payment due when the schedule has one. Permanently recorded in Conversation history, not a toast. Stripe's own automatic Checkout receipt stays on as a redundant, processor-level confirmation — nothing in this build disables it.

**Coordinator-side UI** (`components/payments/payment-schedule-detail.tsx`, `components/payments/payment-status-badge.tsx`, `lib/payments/constants.ts`): a `processing` item gets a distinct blue "in flight" treatment and its manual Pay/Edit/Cancel actions are hidden — Stripe owns that state, a coordinator can't intervene mid-settlement.

## Deliberate scope decisions

- **No new retry-with-backoff queue for Stripe** (unlike QuickBooks) — Stripe's own webhook retry schedule already covers this; building a second one would be redundant, not more correct.
- **`recordEngagementEvent()` is not called from the webhook path.** It resolves its Supabase client from request cookies, which don't exist in a webhook request — calling it would silently do nothing. Skipped rather than built as an unverified parallel variant. This is an activation-analytics signal, not a financial-correctness one; a Stripe-collected payment simply won't register on that particular dashboard yet. Worth a real fix later, not urgent.
- **The branded receipt is the Conversation message itself, not a separate downloadable PDF artifact.** It contains every required field and is permanently recorded, but "reusing the invoice-print infrastructure" (mentioned as a template option in the architecture doc) would mean building an HTML→PDF/attachment pipeline that doesn't exist anywhere in this codebase today. Scoped out as a fast-follow, not silently dropped.

## Verification

**Fully verified against the real local database and the real Stripe SDK (not mocked):**
- Migration applies cleanly; every new/changed column and table confirmed present via `information_schema`.
- `service_role` grants confirmed on every table the webhook path touches, including the two pre-existing gaps found and fixed (`payment_activities`, `luv_celebrations`).
- `get_portal_checkout_context` RPC tested against real fixtures (a real venue, client, portal session, schedule, line item) for every branch: valid request, invalid token, wrong item id, already-paid item (`not_payable`), and a `view_only` session (`not_permitted`) — all five returned exactly the expected result.
- The `pending → processing → pending (revert) → paid` state machine exercised directly against the live database via the service-role client (the same client the webhook route uses) — every transition wrote correctly.
- `payment_activities`/`luv_celebrations`/`conversation_messages` inserts under the `service_role` grants — all three succeeded.
- Stripe's own webhook signature verification (`stripe.webhooks.constructEvent`), which the route depends on: a genuinely-signed test event was accepted, a tampered payload was rejected, and a wrong signing secret was rejected.
- The webhook route's idempotency logic: a real duplicate insert on the same Stripe event id correctly hit the unique constraint.
- **A real bug caught during this verification pass, not shipped**: the original idempotency-row insert stayed in place even when a handler threw, which would have caused Stripe's legitimate retry of a genuinely-failed delivery to be silently swallowed as a "duplicate." Fixed — a failed attempt now deletes its own idempotency row before returning the error, so a real retry goes through cleanly.
- `/api/webhooks/stripe-connect` confirmed reachable without a session (added to the proxy's public-path allowlist — the exact hazard class that's bitten this codebase multiple times before was checked proactively this time, not discovered live).
- `/api/stripe/callback` confirmed to still correctly require a session (same as the QuickBooks callback always has) — not a public webhook, a same-browser OAuth redirect-back.
- `tsc --noEmit` and `next build` both clean after the complete set of changes.
- All fixtures created for verification were cleaned up to zero residue; the one test venue's Stripe connection fields were reverted to their original (`not_started`/disconnected) state.

**Blocked on real Stripe test-mode credentials — cannot be verified in this environment, same posture as QuickBooks:**
1. A real OAuth connect round-trip and confirming `charges_enabled` is read accurately from a real account.
2. A real Hosted Checkout Session completing with Stripe's test card and test bank-account numbers, for both success and cancel paths.
3. A real `payment_intent.succeeded`/`processing`/`payment_failed` webhook delivered by Stripe itself (not hand-constructed) driving the balance/status update end-to-end.
4. A real refund issued through Wevenu, confirming the Stripe API call and the `charge.refunded` webhook both behave as designed.
5. A real disconnect confirmed from Stripe's own dashboard (not just Wevenu's local state).

## Financial Validation checklist (mirrors the QuickBooks one)

Once real Stripe test-mode credentials exist, the full loop to consider this production-ready: connect Stripe, accept a card payment, accept an ACH payment through to settlement, issue a refund on each, fail an ACH payment (insufficient funds test number) and confirm it reverts to pending rather than getting stuck, disconnect, reconnect. If all of those pass, Venue Payment Processing is production-ready.
