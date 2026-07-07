# Trust Risk Register

**Status:** Living document — Phase 1 (Trust Risk Remediation) tracking artifact
**Date:** 2026-07-07
**Owner document for:** `docs/product-completion-roadmap.md` §"Trust Risk Register" (this file is the detailed, trackable version; the roadmap doc keeps a summary and points here)

## Operating Principles

1. **The Trust Risk Register supersedes all other roadmap work.** A feature that can cause a customer to lose money, lose a booking, create legal exposure, or lose trust takes priority over every other item on the Product Completion Roadmap — Operational Completeness and Delight & Polish (Phases 2–3) do not start until every item below is Resolved or has an approved Temporary Mitigation live.
2. **Honestly absent is acceptable. Appears-to-work-but-doesn't is not.** A missing feature can be communicated as roadmap. A feature that looks functional and silently isn't is a trust risk regardless of how small the underlying gap is. Where an item below is "misleading," the required response is one of: fix it, disable it, or clearly label it — never leave it as-is.
3. **Every item here was independently code-verified this session** — not inferred from a feature list. Several were confirmed hands-on (a rolled-back transaction test, a direct RPC call simulating a specific role), not just by reading source.

## How to read this register

Each entry has seven fields:
- **Risk** — what's actually wrong, in plain terms.
- **Customer Impact** — what happens to a real venue/couple/vendor if this goes unaddressed.
- **Severity** — 🔴 Critical / 🟠 High / 🟡 Moderate, based on (a) how directly it causes money/booking/legal harm and (b) how easily normal (non-malicious, non-edge-case) usage triggers it.
- **Temporary Mitigation** — what to do *today*, before the permanent fix ships, per Principle 2.
- **Permanent Fix** — the actual engineering fix.
- **Status** — Identified / Mitigated / In Progress / Resolved. Everything starts at Identified as of this document's creation.
- **Test Plan** — how we'll know it's actually fixed, specific enough to re-run.

---

## MONEY

### TR-M1 — Stripe Connect is a facade
- **Risk:** The Stripe Connect OAuth flow (`components/settings/stripe-connect-section.tsx`, `app/api/stripe/callback/route.ts`) genuinely links a venue's Stripe account and shows "Connected." But there is no `paymentIntent`/checkout-session creation anywhere in the codebase, no Stripe UI in the couple portal's payment section, and `markLineItemPaid` (`lib/payments/service.ts`) is a fully manual "coordinator clicks mark-as-paid" action.
- **Customer Impact:** A venue owner connects Stripe believing Wevenu now processes their deposits/payments. No card is ever actually charged through the app. They discover this only when a real transaction reveals nothing was collected — potentially after telling a couple "you're all set, we'll charge your card."
- **Severity:** 🔴 Critical
- **Temporary Mitigation:** Relabel/gate the Stripe Connect card in Settings today: change copy from "accept deposits and payments directly through Wevenu" to something like "Stripe integration — coming soon. Continue collecting payments outside Wevenu and record them manually for now." Consider disabling the Connect button entirely (matching the setup wizard's own existing "coming soon" treatment of this same step) until the permanent fix ships, so no venue links an account under a false premise in the meantime.
- **Permanent Fix:** Build real payment collection — a Stripe payment element embedded in the couple portal's payment section, real `paymentIntent`/checkout-session creation, webhook-confirmed charge status written back to `payment_line_items`, proper handling of failed/partial charges.
- **Status:** 🟡 Mitigated (permanent fix — real payment collection — not yet built)
- **What shipped:** `components/settings/stripe-connect-section.tsx` and `components/payments/payment-schedule-detail.tsx` rewritten. The Settings card now reads "Online Payment Collection — Coming soon," the "Connect with Stripe" action was removed entirely (no new venue can link an account under the old premise), and an already-connected venue now sees "linking your account doesn't process any payments today." The payments-page callout changed from "Accept online payments with Stripe → Set up Stripe" to "Online payment collection — coming soon," with the Settings link removed.
- **Test performed:** Manual read of both rewritten components + `tsc --noEmit` + full `next build`, both clean. No remaining copy anywhere in the app implies active payment collection.
- **Scorecard impact:** Doesn't move Money out of Red alone — real payment collection (the permanent fix) is still open, tracked separately. Moves the single most severe finding in the register from "active harm" to "honest roadmap."
- **Test Plan (permanent fix, still pending):** connect a real Stripe test-mode account, initiate a real payment from a test couple portal, confirm a real `paymentIntent` is created, confirm webhook updates `payment_line_items.status` correctly on success *and* on a simulated failure (Stripe test card `4000000000000002`), confirm the invoice balance reflects the real charge.

### TR-M2 — Invoice balance silently resets after partial payment
- **Risk:** `recomputeInvoiceTotals` (`lib/invoices/repository.ts:121-128`), triggered by *any* line-item add/remove, unconditionally sets `balance_due = total` with no awareness of payments already collected. `reconcileInvoiceBalance` — the function that correctly computes `balance_due = total - totalPaid` — only ever runs from `markLineItemPaid`, and nothing re-triggers it after a line-item edit.
- **Customer Impact:** Couple pays a deposit → balance correctly shows the remainder. Weeks later, coordinator does completely routine invoice editing (adds a rental fee, removes a discount) → balance silently jumps back to the full original amount, erasing the deposit from the number everyone sees. Nobody notices until reconciliation — by which point the venue may have double-billed, or told the couple they owe more than they do. This is the scenario you flagged as scariest: silent, triggered by normal use, discovered late.
- **Severity:** 🔴 Critical
- **Temporary Mitigation:** None safe to ship as a stopgap that doesn't also fix the root cause — a warning banner ("editing this invoice may affect the displayed balance — verify against Payments before sharing with the client") is the most we'd do temporarily, but this should go straight to a permanent fix given how contained the fix is.
- **Permanent Fix:** Make `recomputeInvoiceTotals` payment-aware — either call `reconcileInvoiceBalance` immediately after it fires, or change its own calculation to `balance_due = total - totalPaid` directly instead of `= total`.
- **Status:** ✅ Resolved
- **What shipped:** `lib/invoices/repository.ts`'s `recomputeInvoiceTotals` now computes `totalPaid` via a new `getTotalPaidForInvoice` helper (same query shape as `reconcileInvoiceBalance` in `lib/payments/repository.ts`, so the two can never disagree) and sets `balance_due = max(0, total - totalPaid)` instead of `= total`.
- **Test performed:** Live database test (rolled back, no data persisted) — created a $1,000 test invoice, recorded a $300 paid deposit (balance correctly dropped to $700), then added a $200 line item (the exact trigger for the original bug). Confirmed: new total = $1,200, new balance = $900 — the $300 payment stayed correctly reflected instead of resetting to $1,200.
- **Scorecard impact:** Removes the register's second-most-severe finding entirely — this was flagged as the scariest item (silent, triggered by routine use, discovered late). Contributes toward moving Money from Red to Yellow, alongside TR-M1's mitigation; Money stays Red overall until TR-M1's permanent fix and TR-M3/M4/M5 close.

### TR-M3 — No refund/void capability exists anywhere
- **Risk:** Repo-wide search for refund/void/reverse logic on payments returns nothing real. `invoices.status = 'void'` only halts future invoice-level actions; it never reverses or adjusts an already-`paid` `payment_line_items` row.
- **Customer Impact:** If a couple is owed money back (cancellation, overpayment, dispute), there is no way to record that in Wevenu at all — the system of record silently diverges from reality the moment a real-world refund happens outside the app.
- **Severity:** 🟠 High (honestly absent, not misleading — see Principle 2. Still Category 1 by impact.)
- **Temporary Mitigation:** None needed — nothing currently implies refunds are supported, so there's no false affordance to disable. Document clearly (in onboarding/support materials) that refunds must be tracked outside Wevenu until this ships.
- **Permanent Fix:** A real refund/void flow: a `refunded`/`partially_refunded` status on `payment_line_items`, a `payment_activities` entry, and `reconcileInvoiceBalance` updated to account for refunded amounts.
- **Status:** Identified
- **Test Plan:** Record a payment, issue a refund, confirm `balance_due` and the activity log both reflect it correctly, confirm the couple portal's payment view reflects the refund rather than showing the original paid amount as still collected.

### TR-M4 — Payments can be marked paid twice
- **Risk:** `markItemPaid`/`markLineItemPaid` have no state guard — callable again on an already-`paid` or even `cancelled` line item. The UI hides the "Pay" button once paid, but the server action doesn't enforce it.
- **Customer Impact:** Doesn't double-count the actual ledger total (the field is overwritten, not summed), but does insert a second "$X received" activity-log entry — a coordinator or an external auditor reconciling the activity log against the ledger will see a mismatch and may reasonably conclude a payment is missing or double-counted.
- **Severity:** 🟡 Moderate
- **Temporary Mitigation:** None needed beyond the existing UI hiding — low likelihood of accidental trigger, no data-loss risk.
- **Permanent Fix:** Add a status guard to `markItemPaid`: no-op (or explicit error) if the item is already `paid` or is `cancelled`.
- **Status:** Identified
- **Test Plan:** Call `markLineItemPaid` twice on the same item id; confirm the second call is rejected/no-ops and no duplicate `payment_activities` row is created.

### TR-M5 — Hard-delete of paid financial records, no guard
- **Risk:** `deleteLineItem` and `deleteSchedule` (`lib/payments/repository.ts`) are true `DELETE`s with no server-side status check. `payment_line_items`/`payment_activities` cascade-delete when their parent `payment_schedules` row is deleted.
- **Customer Impact:** A paid line item — or an entire schedule, including every already-collected installment and its audit trail — can be permanently destroyed via a server action the UI merely tries to hide the button for (only shown when cancelled). No recovery path.
- **Severity:** 🟠 High
- **Temporary Mitigation:** None needed if the permanent fix ships promptly — this requires deliberate action to trigger (not silent/automatic like TR-M2), so it's lower urgency than TR-M1/M2 but should close in the same Phase 1 pass as the other Money items since the fix is small.
- **Permanent Fix:** Add a server-side guard: refuse to hard-delete a line item with `status = 'paid'`, or any schedule containing one, without an explicit confirmation step; consider soft-delete (status flag) instead of `DELETE` for schedules/line items generally, matching the pattern already used elsewhere in the codebase (e.g. `venue_staff.is_active`).
- **Status:** Identified
- **Test Plan:** Attempt to delete a paid line item and a schedule containing a paid item directly via the server action (bypassing the UI); confirm both are rejected with a clear error.

---

## LEGAL

### TR-L1 — Signed contracts can be edited with no guard or audit trail
- **Risk:** `updateContractContent`/`updateContractContentAction` (`lib/contracts/repository.ts:138-143`, `app/(app)/contracts/actions.ts`) have no status check at all — callable against a `"signed"` contract exactly like a `"draft"`. Unlike every other contract mutation in the file, this one never calls `insertContractActivity`, so even a legitimate edit leaves no trace, let alone an illegitimate one.
- **Customer Impact:** The legally-binding text a couple electronically signed is not immutable at the server layer. A dispute over contract terms would find no reliable record of what was actually signed versus what may have been altered afterward — for this specific audience (sophisticated operators who may already rely on contracts for deposits/cancellation terms), this is the most serious legal-exposure item in the register.
- **Severity:** 🔴 Critical
- **Temporary Mitigation:** If the permanent fix can't ship same-day for any reason, temporarily disable the Edit action in the UI for any contract with `status != 'draft'` (partially exists — `contract-detail.tsx` already hides the button — but this is UI-only; do not treat this as sufficient given the server action is directly reachable). Prefer shipping the real guard immediately over relying on the UI-only hide.
- **Permanent Fix:** Add a server-side status guard to `updateContractContent`/the action: reject edits unless `status = 'draft'`. Restore `insertContractActivity` logging on every content edit (draft or otherwise) so there's always a trail.
- **Status:** ✅ Resolved
- **What shipped:** `lib/contracts/repository.ts`'s `updateContractContent` now reads the contract's current status first; returns `{ ok: false, message: "This contract has already been sent and can no longer be edited." }` for any status other than `draft`. On a successful draft edit, it now calls `insertContractActivity(..., "edited", "Contract content edited")` — restoring the audit trail that was previously missing even for legitimate edits. `lib/contracts/service.ts`'s `updateContractContent_` propagates the new result shape; the existing UI (`contract-detail.tsx`) already surfaces `result.message` via toast on failure, so no UI changes were needed.
- **Test performed:** `tsc --noEmit` + full `next build`, both clean. Confirmed via `psql` that the `contracts.status` check constraint (`draft/sent/signed/cancelled/expired`) and default (`'draft'`) match the guard's assumptions exactly. The guard logic itself (read status → compare → conditionally write) is a straightforward two-branch check verified by code review; a live end-to-end run through the actual UI (send a contract, attempt to edit it, confirm the toast) is recommended as a follow-up manual QA pass before this is marked verified-in-production, since this environment doesn't have a way to drive the authenticated browser flow directly.
- **Scorecard impact:** Closes the register's most severe legal-exposure finding. Contributes toward moving the Legal-adjacent portions of Money/Notifications-Permissions-Reporting scorecard categories from Red toward Yellow; full category movement depends on TR-L2/TR-L3/TR-L4 and TR-G1 also closing.

### TR-L2 — Signed contracts can be permanently deleted with no guard
- **Risk:** `deleteContract` (`lib/contracts/repository.ts:153-156`) is a hard `DELETE` with no server-side status check. The UI only shows the Delete button for `"cancelled"` contracts, but the underlying action has no equivalent enforcement.
- **Customer Impact:** The actual legal record can be permanently destroyed, not just altered — worse than TR-L1 in outcome, though likely requires more deliberate action to trigger.
- **Severity:** 🔴 Critical
- **Temporary Mitigation:** Same as TR-L1 — prioritize the real fix over relying on the UI hiding the button.
- **Permanent Fix:** Add a server-side status guard: reject deletion unless `status` is `'draft'` or `'cancelled'`. Consider soft-delete generally for contracts given their legal significance.
- **Status:** ✅ Resolved
- **What shipped:** `lib/contracts/repository.ts`'s `deleteContract` now reads the contract's current status first; only `draft` or `cancelled` contracts can be deleted — anything else returns `{ ok: false, message: "Only draft or cancelled contracts can be deleted. Cancel this contract first." }`. `lib/contracts/service.ts`'s `deleteContract_` propagates the result; existing UI already surfaces the message via toast.
- **Test performed:** Same basis as TR-L1 — `tsc`/`build` clean, DB enum/default confirmed via `psql`, guard logic verified by code review. Live end-to-end QA recommended as a follow-up, same caveat as TR-L1.
- **Scorecard impact:** Same as TR-L1 — the legal record (a signed contract) can no longer be destroyed via the same action used for cleaning up drafts.

### TR-L3 — E-signature captures no real audit trail
- **Risk:** `sign_contract()` records a typed name (`signer_name`) and a timestamp only. No IP address, no user-agent, no separate consent checkbox/disclosure. Possession of the unique sign-token URL is the sole basis for "consent."
- **Customer Impact:** If a signature is ever disputed, there's little to point to beyond "someone with the link typed a name." Sophisticated operators may already use tools with a real audit trail and will notice the downgrade; more importantly, this is genuinely thinner legal ground than the industry standard.
- **Severity:** 🟠 High
- **Temporary Mitigation:** None needed — signing genuinely produces a record today, it's a strength-of-evidence gap, not a misleading affordance. Communicate to early users that e-signature evidence is being hardened (roadmap, not silent).
- **Permanent Fix:** Capture IP address and user-agent at the moment of signing (available from the request in the `sign_contract` API route before calling the RPC), add an explicit consent checkbox ("I agree this constitutes my legal signature") recorded alongside `signer_name`/`signed_at`.
- **Status:** Identified
- **Test Plan:** Sign a test contract through the real flow; confirm `contract_activities` (or a new dedicated column/table) records IP, user-agent, and consent-checkbox state alongside the existing name/timestamp.

### TR-L4 — "Contract signed" automation fires on send, not on signature
- **Risk:** `sendContractAction` (`app/(app)/contracts/actions.ts`) triggers the `"contract_signed"` playbook auto-complete the moment a coordinator clicks *Send for Signing* — before the couple has done anything. The actual signing flow (`signContractByToken`) never calls the playbook trigger at all; it only fires the unrelated activation/analytics engagement event.
- **Customer Impact:** A coordinator sees "contract signed" marked complete on their task list and may proceed on that assumption (schedule vendors, release a hold, tell the couple "you're confirmed") while the couple hasn't actually signed anything yet.
- **Severity:** 🟠 High
- **Temporary Mitigation:** None needed beyond awareness — flag to any current/alpha users that task-list "contract signed" status should be manually double-checked against the actual contract status page until fixed.
- **Permanent Fix:** Move the `triggerAutoComplete(..., "contract_signed")` call from `sendContractAction` to `signContractByToken` (the real signing flow), so the trigger fires on actual signature.
- **Status:** Identified
- **Test Plan:** Send a contract; confirm the "contract signed" playbook task does *not* auto-complete on send. Sign it via the real `/sign/[token]` flow; confirm the task *does* auto-complete at that point.

---

## BOOKING

### TR-B1 — Double-booking isn't server-enforced on the path coordinators actually use
- **Risk:** A dedicated migration hard-blocks double-booking, but only for the public, self-service tour-booking widget, at the whole-venue/date level. Manual event creation/edit — the everyday coordinator path — has zero server-side enforcement. `checkAvailability()` exists but is a client-side-only advisory call, and even that only compares dates, never times.
- **Customer Impact:** A coordinator can save two events in the same space at overlapping times with nothing stopping them beyond an ignorable warning. A double-booking incident on an actual wedding day is business-destroying and reputation-destroying — exactly what this audience will not forgive.
- **Severity:** 🔴 Critical
- **Temporary Mitigation:** None safe as a stopgap beyond making the existing client-side warning more prominent/harder to dismiss (e.g., require typing "CONFIRM" to override) until the real fix ships — but given the fix reuses an existing, proven pattern already in the codebase (the tour-booking migration), this should go straight to the permanent fix rather than a half-measure.
- **Permanent Fix:** Add server-side conflict checking to `lib/events/service.ts`'s `createEvent`/`updateEvent` — same pattern as the tour-booking fix, extended to check both date *and* time-range overlap per space, hard-rejecting (not warning) on a genuine conflict.
- **Status:** ✅ Resolved
- **What shipped:** New `checkEventSpaceConflict` in `lib/events/repository.ts`, called from both `createEvent` and `updateEvent_` in `lib/events/service.ts` before any write. Compares the full setup-through-teardown window (not just the ceremony start/end — so a wedding's 2pm setup through 11pm teardown correctly blocks a back-to-back booking that would only look non-overlapping if you compared ceremony times alone) against every other non-cancelled event in the same space on the same date. Hard-rejects with a descriptive message ("This space is already booked for '{name}' at an overlapping time on this date.") — this is a real block, not a dismissible warning. The existing UI (`event-form.tsx`, `event-edit-form.tsx`) already surfaces `result.message` via toast on failure, so no UI changes were needed.
- **Test performed:** Live database test (rolled back) replicating the exact overlap query and comparison logic against real venue-space data. Four cases, all correct: (1) genuinely overlapping event in the same space/day → conflict detected; (2) same day/time, different space → no conflict; (3) same space/day, non-overlapping time (early brunch well before an evening wedding's setup) → no false-positive conflict; (4) same space/day/time but the existing event is `cancelled` → correctly excluded, no conflict.
- **Scorecard impact:** Closes the register's most business-destroying finding. Calendar moves from Red toward Yellow — the remaining Calendar gaps (no team visibility on the grid, month-only view) are Operational Completeness / Honest V1 Limitation items, not Trust Risks.

### TR-B2 — Tour-booking confirmation emails can fail completely silently
- **Risk:** `app/api/tours/book/route.ts` fires the couple's confirmation email, the coordinator's notification, and reminder scheduling via bare `fetch()`/inserts wrapped in `.catch(() => {})`, with no response-status check and no logging.
- **Customer Impact:** The tour itself is safely booked in the database, but if the confirmation email fails, neither party is told, nothing retries, and there's no record it happened — a couple could show up unprepared, or a coordinator could miss that a tour was booked at all if they rely on the email rather than checking the app.
- **Severity:** 🟡 Moderate–High
- **Temporary Mitigation:** None needed beyond awareness; the booking itself is safe.
- **Permanent Fix:** Route these sends through the shared `sendEmail()` helper (which has better error surfacing than a raw `fetch`), check response status, and log failures to `notification_log` so they're at least visible in Wevenu HQ's System Health view.
- **Status:** Identified
- **Test Plan:** Simulate a Resend API failure (e.g. invalid API key in a test environment) during a tour booking; confirm the failure is now logged/visible rather than silently discarded.

### TR-B3 — Questionnaire "send" reports success even when the email fails
- **Risk:** `sendQuestionnaire` (`lib/events/questionnaire.ts`) returns `{ ok: true }` unconditionally, regardless of whether the underlying email actually sent.
- **Customer Impact:** A coordinator believes a critical pre-wedding information request went out; the couple never received it; nothing surfaces the discrepancy until it's noticed manually, potentially too close to the wedding date to matter.
- **Severity:** 🟡 Moderate
- **Temporary Mitigation:** None needed beyond awareness.
- **Permanent Fix:** Return the actual send result from `sendEmail()` rather than a hardcoded `ok: true`, and surface a failure to the coordinator's UI.
- **Status:** Identified
- **Test Plan:** Simulate an email-send failure; confirm the function now returns a failure result and the UI reflects it rather than reporting success.

---

## BUSINESS RISK / GOVERNANCE

### TR-G1 — Permissions are entirely cosmetic
- **Risk:** `StaffRole` (`owner`/`manager`/`staff`) exists only as a label. Repo-wide search for role-gating logic against it returns nothing — no server action, API route, or RLS policy restricts a `'staff'`-role team member from anything an owner can do.
- **Customer Impact:** Any invited team member has full access to every financial figure, can delete records (including, per TR-L1/TR-L2/TR-M5, signed contracts and paid invoices), and can change other people's roles — regardless of intent. This is a trust risk for the venue owner themselves, not just their customers, and it's the mechanism that widens the blast radius of several other items in this register.
- **Severity:** 🔴 Critical
- **Temporary Mitigation:** Document clearly (support materials, maybe an in-app note on the Team settings page) that all invited team members currently have full access, so venue owners aren't surprised. This is honest-absence communication per Principle 2, not a fix.
- **Permanent Fix:** Real server-side + RLS enforcement, gating at minimum: deletion of contracts/payments/clients/events, financial figure visibility, and team/role management, behind `owner`/`manager`. The vendor-side role system already gates correctly elsewhere in this codebase (`lib/vendor-packages/service.ts`) — replicate that proven pattern for venue staff rather than designing from scratch.
- **Status:** Identified
- **Test Plan:** As a `'staff'`-role user, attempt to delete a contract, delete a paid invoice line item, view venue-wide financial totals, and change another staff member's role. Confirm all four are rejected. Confirm the same actions succeed as `'owner'`/`'manager'` per the agreed scope.

### TR-G2 — No data export exists, venue or couple side
- **Risk:** Confirmed absent everywhere in the codebase — the only "export" language anywhere refers to other tools' exports being imported *into* Wevenu, never the reverse, on either the venue or couple side.
- **Customer Impact:** Given this exact audience's history — a platform disappearing on them once already — the inability to get their own data out is existential to the trust-rebuilding premise, not merely a completeness gap.
- **Severity:** 🔴 Critical (by trust impact, though honestly-absent in character — see Principle 2)
- **Temporary Mitigation:** None needed — nothing implies this exists today, so there's no misleading affordance. Communicate clearly that it's coming before Trust Beta.
- **Permanent Fix:** A real "Export my data" action in Settings (venue side: clients, events, payments, contracts metadata at minimum) and an equivalent in the couple portal (guest list, budget, seating), producing real downloadable files (CSV/JSON).
- **Status:** Identified
- **Test Plan:** Trigger the export as a venue owner; confirm the resulting file contains real, complete data matching what's in the app. Repeat for the couple-side export.

---

## Summary Table

| ID | Risk | Category | Severity | Status |
|---|---|---|:---:|---|
| TR-M1 | Stripe Connect is a facade | Money | 🔴 Critical | 🟡 Mitigated (permanent fix pending) |
| TR-M2 | Invoice balance resets after partial payment | Money | 🔴 Critical | ✅ Resolved |
| TR-M3 | No refund/void capability | Money | 🟠 High | Identified |
| TR-M4 | Payments markable paid twice | Money | 🟡 Moderate | Identified |
| TR-M5 | Hard-delete of paid financial records | Money | 🟠 High | Identified |
| TR-L1 | Signed contracts editable, no guard/trail | Legal | 🔴 Critical | ✅ Resolved |
| TR-L2 | Signed contracts permanently deletable | Legal | 🔴 Critical | ✅ Resolved |
| TR-L3 | E-signature audit trail is thin | Legal | 🟠 High | Identified |
| TR-L4 | "Contract signed" trigger fires on send | Legal | 🟠 High | Identified |
| TR-B1 | Double-booking not server-enforced | Booking | 🔴 Critical | ✅ Resolved |
| TR-B2 | Tour confirmation emails fail silently | Booking | 🟡 Moderate–High | Identified |
| TR-B3 | Questionnaire send reports false success | Booking | 🟡 Moderate | Identified |
| TR-G1 | Permissions are cosmetic | Governance | 🔴 Critical | Identified |
| TR-G2 | No data export | Governance | 🔴 Critical | Identified |

**Same-day batch complete: 4 of 14 Resolved, 1 Mitigated. 8 Critical, 4 High, 2 Moderate total — of the 8 Critical items, 4 are now closed (TR-M2, TR-L1, TR-L2, TR-B1) and 1 is mitigated (TR-M1).** Remaining: TR-G1 (permissions — design scoping starting in parallel per the roadmap), TR-M3/M4/M5, TR-L3/L4, TR-B2/B3, TR-G2. This table is the thing to re-run after the rest of Phase 1 closes — same IDs, updated Status column, alongside the category-level Trust Beta Scorecard re-run.
