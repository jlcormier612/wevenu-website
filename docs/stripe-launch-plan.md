# Stripe Connect — Launch Plan

**Sprint 3, Item 5. Research and inventory only — no implementation. Waiting for approval.**

**Date:** 2026-07-21 (Hosted Checkout confirmed as the approved direction 2026-07-21 — see §3.1)

This is a major initiative. A full architecture pass, `docs/stripe-payment-architecture.md`, already exists (dated 2026-07-07, TR-M1's designed permanent fix) — this document does **not** re-derive that design from scratch. It (a) confirms the existing design against the current live codebase, since real changes have happened since it was written (the Stripe card is now explicitly "coming soon," QuickBooks shipped and sets several new precedents worth reusing), (b) inventories exactly what exists today per the sprint prompt's checklist, and (c) reconciles the real gap between the prior design and this sprint's new requirements — the prior design recommended an embedded Payment Element; **Hosted Checkout is now the confirmed, approved direction**, overriding that earlier recommendation. Still research/inventory only — no implementation yet, waiting for the go-ahead to build.

---

## 1. Inventory — what exists today, verified against live code

### Invoices
`invoices`/`invoice_line_items` (`lib/invoices/`) — full lifecycle (draft → sent → paid → void), Event Order-linked freeze-on-send (Booking Financial Architecture Phase 3), QuickBooks sync status columns added this sprint's earlier QuickBooks work. Fully real, fully shipped. No gaps relevant to Stripe collection itself — invoices are the thing a payment is ultimately collected against, and that model doesn't need to change for Stripe to plug in.

### Payment schedules & balances
`payment_schedules`/`payment_line_items` (`lib/payments/`) — one schedule can link to an invoice (`invoice_id`), individual line items carry `amount`/`paid_amount`/`status`/`due_date`/`refunded_amount`/`refunded_at`/`refund_reason` (TR-M3). `reconcileInvoiceBalance()` keeps the linked invoice's `balance_due` in sync whenever a line item's paid status changes — **this is the exact function any real Stripe webhook handler should call**, not new balance logic. `paymentMethod = 'stripe'` already exists as a selectable value in `lib/payments/constants.ts`'s `PAYMENT_METHODS` — today it only means "a coordinator is manually recording a Stripe payment that happened outside the app" (e.g. over the phone via a Stripe Payment Link); it is **not** currently wired to any real API call.

### Reminders
Payment-due reminders exist as a message-template type (`lib/message-templates/`), driven through the existing notification/automation engines — not Stripe-specific, and nothing here needs to change for Stripe collection; a successful Stripe payment should simply cause the existing "payment due" reminder logic to stop firing the same way a manually-recorded payment already does (via `markLineItemPaid`'s existing status update, which any real Stripe webhook handler would also call).

### Payment recording
`markLineItemPaid()`/`refundLineItem_()` (`lib/payments/service.ts`) are the two functions that mutate payment state today — both manual-entry paths (a coordinator clicking "Mark Paid" or issuing a refund). Both already call `reconcileInvoiceBalance`, write to `payment_activities` (audit trail), and — as of this sprint's QuickBooks work — enqueue a QuickBooks sync. **Any real Stripe integration should call into these same functions from a webhook handler, not duplicate their logic** — the only new thing needed is *what triggers the call* (a webhook instead of a click), not the mutation itself.

### Webhooks
**None exist for Stripe today.** No `app/api/webhooks/stripe*` or `app/api/stripe/webhook*` route exists anywhere in the codebase — the only Stripe route is the OAuth callback (`app/api/stripe/callback/route.ts`), which links an account but never processes a payment event. This is the single largest missing piece, confirmed by direct search, not assumed.

### Customer model
There is no Stripe Customer object concept anywhere in this codebase today — `clients` has no `stripe_customer_id` column (unlike the QuickBooks integration, which added `quickbooks_customer_id` to `clients` this sprint). Whether a Stripe Customer object needs to be created per Wevenu `client` at all depends on the checkout-method decision below (see §3) — Hosted Checkout and Payment Element both *can* work without a persisted Customer object (guest checkout), but a persisted Customer is what enables saved payment methods for a repeat/installment payer, which is worth deciding explicitly rather than defaulting silently.

### Existing Stripe code
- `app/api/stripe/callback/route.ts` — OAuth callback, exchanges `code` for a connected account ID via `Authorization: Bearer {STRIPE_SECRET_KEY}`, no `state` validation (see below).
- `lib/venue/service.ts:330-353` — `connectStripeAccount()`/`disconnectStripeAccount()`. **Confirmed live, two real gaps, both already flagged in the prior architecture doc and still unfixed:**
  - `connectStripeAccount()` sets `stripe_charges_enabled: true` unconditionally the moment OAuth succeeds — it never checks Stripe's own `charges_enabled` flag on the connected account, so a venue mid-KYC shows as "ready to charge" when they're not.
  - `disconnectStripeAccount()` only clears local venue columns — it **never calls Stripe's own account-disconnect/deauthorize endpoint**, unlike the QuickBooks disconnect flow built this sprint, which explicitly calls Intuit's revoke endpoint before clearing local state. This is a real, live gap: disconnecting in Wevenu's Settings does not actually revoke Wevenu's API access to the venue's Stripe account from Stripe's side.
- `components/settings/stripe-connect-section.tsx` — **confirmed: the "Connect with Stripe" action has been intentionally removed.** The card is explicitly "Coming soon" (badge, line 56), with copy stating "there's nothing to connect here" for a not-yet-connected venue, and a warning-styled notice for an already-connected venue explaining "linking your account doesn't process any payments today." This was a deliberate TR-M1 decision (per the docstring, lines 21-28: "honestly absent, not misleading" — don't offer a Connect button that leads nowhere real). **This means: reintroducing a working "Connect with Stripe" button is itself part of this sprint's implementation scope, not just the payment-processing pieces behind it** — the button was deliberately taken away and needs to come back once there's something real behind it.
- The `stripe` npm package is **not installed** (`package.json` has no `stripe` dependency) — every piece of this implementation is currently blocked on adding it plus real credentials, same as the original architecture doc already stated.

---

## 2. What the prior architecture doc already decided (still valid, confirmed against current code)

From `docs/stripe-payment-architecture.md`, still correct and not re-litigated here:
- **Two systems, never share code paths** — System A (Wevenu's own SaaS billing, out of scope) vs. System B (venue↔couple payments, this document's entire subject). Still the right framing.
- **Connect account type: Standard** (already what the existing OAuth flow uses) — confirmed still correct; a Standard account keeps Wevenu genuinely hands-off of the venue's funds/compliance, which is the whole point.
- **Charge type: Direct Charges, not Destination Charges** — confirmed still the right call for "Wevenu facilitates, never holds funds."
- **Data model additions**: `payment_line_items.stripe_payment_intent_id`/`stripe_charge_id`, `venues.stripe_charges_enabled_verified_at` — still the right minimal, additive shape. (Given the new "Customer model" question above, likely also needs `clients.stripe_customer_id` if a persisted Customer is decided on.)
- **Refunds branch on whether the original payment was real** (`stripe_payment_intent_id` present → call the real Stripe refund API and let the webhook confirm; absent → TR-M3's existing ledger-only path, untouched) — still correct, and now also needs the same branching logic added to the QuickBooks refund sync built this sprint (a Stripe-refunded payment should still push a QuickBooks RefundReceipt the same way a manually-recorded refund does — no change needed there, just confirming the two integrations compose without conflict).

---

## 3. Reconciling this sprint's new requirements against the prior design

### 3.1 Hosted Checkout — confirmed as the approved direction

The prior architecture doc (`docs/stripe-payment-architecture.md`) had recommended against a redirect-based checkout, reasoning that leaving the portal "cuts against the polished, cohesive portal experience this whole trust-rebuilding effort is about," and designed around an embedded Payment Element instead. **This is now explicitly overridden: Hosted Checkout is the confirmed, approved direction for implementation.** These were two different, mutually exclusive checkout implementations, not a small variation of each other:

| | Embedded Payment Element (prior design, superseded) | Hosted Checkout (approved) |
|---|---|---|
| Where the couple pays | Inside the Wevenu portal, no redirect | Stripe-hosted page, couple leaves the portal, returns after |
| Build effort | More (client-side Stripe.js integration, PaymentIntent creation, embedded UI) | Less (create a Checkout Session server-side, redirect, Stripe handles the entire payment UI) |
| Direct Charges on connected accounts | Fully supported | Fully supported (Checkout Sessions support `on_behalf_of`/connected-account scoping) |
| Couple experience | Stays inside Wevenu's branded portal throughout | Briefly sees Stripe's own checkout UI (which *can* be branded with the venue's logo/colors via Stripe's own branding settings on the connected account, partially closing this gap) |

Hosted Checkout is just as architecturally sound as the superseded Payment Element design (still Direct Charges, still Standard Connect, still "Wevenu never touches funds") — the only real tradeoff versus the prior recommendation is the portal-cohesion argument the earlier design was built around, which this decision knowingly accepts in exchange for materially less build effort. Every section below (§4 implementation plan, §5 verification plan) is already written against Hosted Checkout, not the superseded alternative.

### 3.2 New requirements not covered by the prior design

**Receipts.** Nothing in this codebase generates a payment receipt today (confirmed by search — no receipt-generation code exists anywhere). Two paths: (a) rely entirely on Stripe's own automatic email receipts (Checkout Sessions can be configured to send one automatically, zero Wevenu code needed, but it comes from Stripe's own branding/sender, not the venue's), or (b) generate a Wevenu-branded receipt (reusing the existing PDF/print infrastructure already built for invoices — `app/(app)/invoices/[id]/print/page.tsx` is the closest template) and deliver it through the existing Conversations channel (see below) rather than a separate email system. Recommend (b) for brand consistency (matches this engagement's repeated "the couple should remember the venue, not the software" principle from the Venue Brand Experience initiative), using Stripe's own receipt only as a redundant backstop, not the primary experience.

**Conversation updates.** This codebase's Conversations model already has a `sender_type = 'system'` value on `conversation_messages` (confirmed in schema) — exactly the mechanism for this. A successful/failed Stripe payment should insert a `conversation_messages` row (`channel: 'internal_note'`, `sender_type: 'system'`, e.g. "Payment received: $500.00 via Stripe" / "Payment failed: card declined") into the relevant Conversation, giving the coordinator a durable, visible record without needing to remember to log it themselves — directly matching this engagement's standing "never require a venue to remember what to send" principle. This is new code (no existing precedent inserts an automated system message today, though the schema already supports it) but small and low-risk.

**Disconnect / Reconnect.** Reconnect is just re-running OAuth (already works, once the Connect button returns per §1). Disconnect needs the same real fix already identified in §1 — call Stripe's actual account-deauthorization endpoint (`POST /oauth/deauthorize`) before clearing local state, mirroring the QuickBooks disconnect flow built this sprint (best-effort revoke, always clear local state regardless of revoke success so a venue is never stuck "connected" locally to a revoke call that failed for an unrelated reason).

---

## 4. Complete implementation plan

Building directly on the prior architecture doc's decisions (§2) plus this sprint's reconciliations (§3):

1. **Restore the Stripe Connect button** (`components/settings/stripe-connect-section.tsx`) — no longer "coming soon," now genuinely connects, with the real `charges_enabled` check added to `connectStripeAccount()` (§1's confirmed gap) and real deauthorization added to `disconnectStripeAccount()` (§1's confirmed gap).
2. **Hosted Checkout Session creation** — a new server action/route creating a Stripe Checkout Session scoped to the venue's connected account (Direct Charge equivalent for Checkout: `payment_intent_data.on_behalf_of` or the connected-account-scoped API call, depending on final Stripe API shape at build time), one Session per `payment_line_item`, redirecting the couple to Stripe's hosted page and back to the portal on completion/cancellation.
3. **Webhook processing** — new route (e.g. `app/api/webhooks/stripe-connect/route.ts`), configured as a Stripe Connect webhook endpoint (receives events from every connected account). Mandatory signature verification (`stripe.webhooks.constructEvent`). Handles `checkout.session.completed` (the Hosted Checkout equivalent of `payment_intent.succeeded`), `payment_intent.payment_failed`, `charge.refunded`. Maps the event's `account` field back to `venues.stripe_account_id` to find the right venue. Idempotency via a unique constraint/check-before-write on `stripe_payment_intent_id`, mirroring the exact pattern this engagement just built for the QuickBooks sync queue's own idempotency.
4. **Automatic balance updates** — the webhook handler calls the existing `markLineItemPaid()`/`reconcileInvoiceBalance()` functions directly, exactly as a coordinator's manual "Mark Paid" click already does — no new balance-calculation logic anywhere.
5. **Conversation updates** — the webhook handler additionally inserts a `sender_type: 'system'` `conversation_messages` row on success/failure (§3.2).
6. **Receipts** — on `checkout.session.completed`, generate and deliver a Wevenu-branded receipt through the same Conversation (as an attachment or portal-visible record), reusing existing invoice-print infrastructure as the template (§3.2).
7. **Refunds** — `refundLineItem_()` branches on `stripe_payment_intent_id` presence: real Stripe refund API call (`stripe.refunds.create`, still Owner-only per TR-M3) when present, existing ledger-only path when absent. The `charge.refunded` webhook confirms and finalizes rather than the UI optimistically marking it refunded before Stripe confirms.
8. **Disconnect / Reconnect** — per item 1 and §3.2.
9. **New environment variables**: `STRIPE_SECRET_KEY` (already referenced in the prior doc's OAuth flow, reused here for Checkout Session/webhook calls), `STRIPE_WEBHOOK_SECRET` (new, Connect webhook endpoint), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (only needed if any client-side Stripe.js is used at all under Hosted Checkout — likely minimal/none, since Hosted Checkout is primarily server-driven redirect, unlike the Payment Element path which required it).

---

## 5. Verification plan (once real Stripe test-mode credentials exist — same posture as this sprint's other financial work)

Everything not requiring a live Stripe round-trip can be built and verified now (webhook signature verification logic against a locally-signed test payload, idempotency-constraint behavior, the Conversation-message insert, the receipt-generation code path using a synthetic completed-session payload) — mirroring exactly how this session's QuickBooks integration was verified against real Intuit sandbox endpoints using fake-but-realistic credentials to exercise genuine error-handling paths before real credentials existed. The one thing that cannot be verified without a real Stripe test-mode account: an actual successful Direct Charge landing in a real connected account's balance, and Stripe's real webhook delivery round-trip.

1. Restore-Connect-button flow: real OAuth round-trip against a live (test-mode) Stripe Connect account, confirm `charges_enabled` is read and stored accurately, not just assumed true.
2. Hosted Checkout: create a real test-mode Checkout Session, complete it with Stripe's test card numbers, confirm redirect-back behavior in both success and cancel paths.
3. Webhook: confirm signature verification rejects a tampered payload and accepts a genuinely Stripe-signed one; confirm `checkout.session.completed` correctly calls `markLineItemPaid`/`reconcileInvoiceBalance` and that the invoice balance actually updates.
4. Idempotency: replay the same webhook event twice, confirm no duplicate payment recording.
5. Conversation + receipt: confirm the system message appears in the correct Conversation and the receipt is generated/delivered correctly.
6. Refund: issue a real test-mode refund through Wevenu, confirm the money-movement API call fires and the `charge.refunded` webhook correctly finalizes the ledger (not an optimistic pre-confirmation update).
7. Disconnect: confirm Stripe's own dashboard shows the connection actually revoked, not just Wevenu's local state cleared.
8. Standard `tsc --noEmit`/`next build` clean pass.

---

## 6. Open decisions needing approval before coding starts

1. ~~Hosted Checkout vs. embedded Payment Element (§3.1)~~ — **Resolved 2026-07-21: Hosted Checkout is the approved direction.** No longer open.
2. **Stripe Customer object** — persist a `stripe_customer_id` on `clients` (enables saved payment methods for repeat/installment payers) or stay fully guest-checkout (simpler, no new column, no saved-card convenience)? Recommend guest-checkout for v1 given the "one PaymentIntent/Session per line item" installment model doesn't strictly need a persisted Customer, but flagging since it's a real scoping choice.
3. **Application fee** — does Wevenu take a percentage of venue↔couple payments (a real Wevenu revenue line), or is this purely a facilitation feature with Wevenu Billing (System A) as the only revenue source? Carried over from the prior doc's still-open question #1.
4. **Payment methods beyond card** — Checkout Sessions support ACH/bank debit with minimal extra configuration; card-only for v1, or include ACH now? Carried over from the prior doc's open question #2.
5. **Receipt approach (§3.2)** — recommend a Wevenu-branded receipt via existing invoice-print infrastructure + Conversations delivery, with Stripe's own automatic receipt as a redundant backstop only; confirm, or prefer relying on Stripe's receipt alone for v1 (less work, less brand-consistent).
