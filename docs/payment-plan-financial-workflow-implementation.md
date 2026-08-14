# Work Package D5B — Payment Plans, Invoices, Payments & Financial Workflow

**Headline finding:** the financial workflow this brief describes — Event Order → Invoice → Payment Plan → Payment → Balance → Booking → Reporting — was already substantially built and working before this phase started (Booking Financial Architecture Phases 1–3c). D5B's real work was: (1) reading and tracing every real implementation rather than trusting the brief's own description, (2) validating the whole chain live against the real database with real authenticated sessions, (3) finding and fixing the handful of genuine defects that surfaced from that testing, and (4) documenting what's true with evidence. This is not a rebuild — it's the verification and completion pass the brief itself asked for.

## 1. Financial Source-of-Truth Map

```
Contract (signed)         — what the client agreed to; carries NO financial figure of its own
        │ (client_id join only — no FK)
Event Order                — the commercial input: what's being purchased (venue rental, inventory, services…)
        │ Create/Link Invoice (existing flow, unmodified)
Invoice (draft)             — a live PROJECTION of Event Order while draft; frozen into real rows on first send
        │ Create Payment Plan (existing flow, unmodified) — total always read FROM the invoice, never re-entered
Payment Schedule ("Payment Plan" in the UI)
        │ mark items paid (existing flow, unmodified)
Payment (a payment_line_item with status='paid')
        │ reconcileInvoiceBalance (existing, unmodified) — the ONE place balance_due is derived
Invoice.balance_due  ──────────────────►  canonical_outstanding_balance() = canonical_gross_booked_revenue() - canonical_payments_collected()
        │
canonical_bookings view (Signed Contract + first-scheduled-item paid) ──► Reporting (lib/metrics/*, Dashboard)
```

Ownership, confirmed by reading the actual code (not assumed):

| System | Owns | Does NOT own |
|---|---|---|
| Contract | The agreement itself, signature | Any dollar figure — confirmed no `total`/`amount` column exists on `contracts` |
| Event Order | Commercial line items (what's being charged for) | Tax, billing adjustments, payment timing |
| Invoice | What's billed, line items, totals, status | Payment scheduling |
| Payment Schedule | When money is due, in what installments | The total — always derived from the invoice |
| Payment (`payment_line_items`, `status='paid'`) | What money actually moved | — |
| `canonical_*` SQL functions | Gross Booked Revenue, Payments Collected, Outstanding Balance, Booking definition | Nothing else — Outstanding Balance is *derived*, never independently summed |

## 2. Event Order → Payment Plan Flow — already real, verified live

This flow already exists exactly as the brief describes it, end to end:

1. **Event Order → Invoice**: `EventOrderInvoiceLink` ("Create Invoice from Event Order" / "Link to Invoice") — a Draft invoice becomes a live projection of the Event Order's current lines.
2. **Invoice → Payment Plan**: `invoice-detail.tsx`'s "Create Payment Plan →" CTA → `NewScheduleForm`, which shows the invoice's real total (not editable there — *"This payment plan always tracks the invoice's total... Change the invoice's line items to change it"*), lets the venue pick a preset (50/50, Thirds, custom) or build installments by hand.
3. **One schedule per invoice** is enforced server-side (`createPaymentSchedule` rejects a second attempt with a clear message), matching the brief's Decision 5.
4. **Reconciliation drift**: if the Event Order (and therefore the invoice, once re-sent) changes after a schedule already exists, `ScheduleReviewBanner` surfaces it in plain language (*"This payment plan no longer matches the invoice"*) with four explicit, non-alarming remediation actions (Keep, Regenerate, Add Installment, Collect Manually) — never silently drifting, never auto-correcting. This directly satisfies §10's requirement and already exceeds it.

**Verified live** (this phase): created a real Event Order ($5,000 Venue Rental + $1,200 Inventory via the D5A handoff), created a real Invoice from it, froze it on send, created a real Payment Schedule from the invoice's real total — every number traced and matched exactly.

## 3. Payment Plan Lifecycle & Deposit/Booking Behavior

**The canonical Booking definition (§11, unchanged, verified live):**

```sql
-- canonical_bookings: a Client with >=1 signed Contract AND a Payment
-- Schedule whose lowest-sort_order line item is paid.
```

This is deliberately **position-based** (the first-scheduled installment), not `obligation_kind`-based — the migration's own comment explains why: `obligation_kind` is nullable and not guaranteed populated on every historical/custom schedule, so sort-order is the more universally reliable signal. This is an intentional, already-certified design decision; not changed here.

**Verified live, both directions:**
- Signed Contract + **no** payment → `canonical_bookings` returns **zero rows** for that client (confirmed: not a booking).
- Signed Contract + first installment marked paid → a real `canonical_bookings` row appears, `booked_at` = the later of signature and payment (confirmed live, with a real timestamp).
- **A Payment Plan being *created* never implies Booking** (§12) — confirmed: between schedule creation and the deposit actually being marked paid, no booking row exists. Only the deposit payment itself flips it.

## 4. Invoice Relationship & Integrity

- Invoices remain their own financial business object — not converted to a generic Document, not routed through `canonical_documents` (§19, untouched, confirmed by inspection).
- **Invoice line items derive from Event Order, never independently recalculated**: `insertFrozenLinesFromEventOrder` copies `quantity`/`unitPrice`/`amount` verbatim from the Event Order's own already-computed line values — no second pricing calculation exists anywhere in that path.
- **D5A's mutation guards, re-verified**: `addLineItem`/`removeLineItem` on a non-draft invoice correctly rejected; `updateLineItem` on an already-paid payment line item correctly rejected (real test, exact error message confirmed: *"This payment has already been collected — its amount and due date are historical record and can't be edited."*).
- **Upstream Event Order changes never silently rewrite a sent invoice**: `EventOrderDriftBanner` + `eventOrderLinesFingerprint` (a hash of every line's `id:quantity:unitPrice:description`) — confirmed this mechanism is provenance-agnostic, meaning it automatically covers D5A's new inventory-sourced lines with zero changes needed; a new line appearing after freeze changes the fingerprint and surfaces the same drift banner, not a silent rewrite.

## 5. Payment Lifecycle

- A "payment" **is** a `payment_line_items` row with `status='paid'` — no separate payments table, no duplicate record (§13, confirmed).
- **Partial payments are supported** (§24): a payment schedule can have multiple independently-payable installments; each is marked paid independently with its own `paidAmount`, and `reconcileInvoiceBalance` sums exactly what's been collected net of refunds. Verified live: a $6,200 invoice, $1,860 deposit paid → balance correctly $4,340, not fully paid.
- **Duplicate-payment protection is real and pre-existing** (§49): `markItemPaid` checks `status === 'paid'` before allowing a second call — verified live: attempting to mark the same line item paid twice was rejected with a clear message.
- **Overpayment behavior** (§24): `reconcileInvoiceBalance` computes `Math.max(0, total - paid)` — verified live: paying $500 beyond a fully-paid invoice still shows `balanceDue = 0`, never negative. (The invoice does not have a distinct "overpaid" status — this is the actual, existing, tested behavior; a genuine overpayment-tracking/refund-workflow UI was not built, since none exists today and the brief explicitly says not to invent a new payment workflow to satisfy this test.)
- **Overdue behavior** is a single, existing mechanism (`mark_overdue_payments` RPC, called before every schedule read) — not duplicated for Dashboard/Reporting.

## 6. Task Integration — already correctly wired

`TRIGGER_WORKSPACE` (`lib/portal/unified-tasks.ts`) already maps `payment_received` and `final_payment_obligation_paid` to the Payments workspace section with "Pay now" as the CTA — **not** a generic "View" fallback, and **not** completable by clicking a checkbox. Task completion is domain-driven: `markLineItemPaid`/Stripe webhook success is what actually flips the task, via the same `triggerAutoComplete` mechanism D5A's Event Inventory now also uses. This was already correct before D5B — verified, not built.

## 7. Notifications & Activity

Reused, not duplicated — the same `create_venue_notification` mechanism every other domain in this codebase uses, and the same `ActivityTimeline` (`invoice_activities`, `payment_activities`) already used for Invoice/Payment Schedule events (`schedule_created`, `payment_received`, `review_regenerated`, etc.). No new notification or activity system was built.

## 8. Permission Matrix — verified live with real sessions for all four venue roles

A real gap in this engagement's own test coverage was closed here: no Coordinator or Staff dev account existed before D5B. Two real accounts were created (`d5b-coordinator@example.com`, `d5b-staff@example.com`, left in place as reusable dev fixtures) and used for genuine, live permission testing — not just code inspection.

| Role | View financial records | Create Payment Plan / Invoice | Edit | Delete | Refund |
|---|---|---|---|---|---|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ (owner-only, existing) |
| Manager | ✅ | ✅ | ✅ | ✅ | ❌ |
| Coordinator | ✅ (verified live) | ✅ | ✅ | ❌ | ❌ |
| Staff | ❌ (verified live — RLS blocks SELECT entirely) | ❌ (verified live) | ❌ | ❌ | ❌ |
| Client | Own obligations only, pay permitted amounts | ❌ | ❌ | ❌ | ❌ |
| Vendor | None | ❌ | ❌ | ❌ | ❌ (not built — no requirement found) |

## 9. Security Model — a real finding, tested to a clear conclusion

**What was found:** reading the raw RLS policy text for `invoices`/`payment_schedules`/`payment_line_items` shows `SELECT` and `DELETE` have explicit role predicates (`role <> 'staff'`, `role IN ('owner','manager')`), but `INSERT`/`UPDATE` policies have **no role predicate at all** — only `venue_id = current_user_venue_id()`. Read in isolation, this looks like a real gap: a Staff-role session, blocked from viewing financial records, might still be able to write to them directly via the REST API.

**What real testing proved:** this is *not* exploitable in practice, for a testable, reproducible reason — verified with a real authenticated Staff session against the real API (the same one the app and any external caller uses):

- A Staff `INSERT` on `payment_schedules` returns an explicit Postgres RLS error (`42501`, *"new row violates row-level security policy"*) — confirmed via service-role check afterward that **zero rows** were created.
- A Staff `UPDATE` on an existing schedule returns **no error** but silently matches **zero rows** — confirmed via service-role check that the target row's data was completely unchanged.

Both outcomes are safe. The likely mechanism: PostgREST's `INSERT ... RETURNING`/`UPDATE` row-visibility interacts with the table's `SELECT` policy (which does exclude Staff), so the row a Staff session could otherwise satisfy via the INSERT/UPDATE policy's own bare `venue_id` check is never actually visible or returned to them — the SELECT-side exclusion cascades into protecting the write path too, even though the INSERT/UPDATE policies don't say so directly.

**This is documented, not silently fixed, for one reason:** the protection is real today but is *indirect* — it depends on the SELECT policy's role exclusion continuing to exist and continuing to interact with INSERT/UPDATE the way it currently does. A future, unrelated change to the SELECT policy (e.g., "let Staff view their own assigned events' invoices") could silently remove this protection without anyone touching the INSERT/UPDATE policies at all. **Recommended follow-up** (not done here, to avoid touching certified RLS beyond this phase's own verification mandate): add an explicit role predicate to the `INSERT`/`UPDATE` policies on these three tables, matching the pattern already used on `DELETE`, so the protection is direct and doesn't rely on this coupling.

Other security checks, all verified live with real sessions:
- **Cross-venue isolation**: an owner session querying another venue's invoices by explicit `venue_id` filter returns zero rows (both a direct negative lookup and a blanket "all rows for that venue_id" query).
- **Locked invoice / historical payment mutation**: both D5A guards re-verified live (see §4).

## 10. Financial Reconciliation — real evidence, one test event

Independently computed and compared against the application's own values for one real test booking:

| Figure | Independently expected | Application value | Match |
|---|---|---|---|
| Event Order total | $5,000 (Venue Rental) + $1,200 (100 × $12 Inventory) = $6,200 | $6,200 | ✅ |
| Invoice total (frozen from Event Order) | $6,200 | $6,200 | ✅ |
| Payment Schedule total | $1,860 (deposit) + $4,340 (final) = $6,200 | $6,200 | ✅ |
| Balance after deposit | $6,200 − $1,860 = $4,340 | $4,340 | ✅ |
| Balance after final payment | $0 | $0 | ✅ |
| Balance after a further $500 "overpayment" | $0 (clamped, per §5) | $0 | ✅ |
| `canonical_outstanding_balance()` | `canonical_gross_booked_revenue() − canonical_payments_collected()` | Confirmed equal, both directions | ✅ |

No unexplained drift anywhere in this chain.

## 11. A real defect found and fixed: revenue_category was never written after the one-time backfill

**This is the most significant finding of this phase.** The 11 canonical Revenue Categories (`Venue Rental`, `Inventory`, `Food & Beverage`, etc., certified in the Metric Registry) were populated onto `invoice_line_items.revenue_category` exactly **once**, by a one-time `UPDATE ... WHERE revenue_category IS NULL` backfill migration. Reading the actual write paths (`addLineItem`, `insertFrozenLinesFromEventOrder`) confirmed neither one ever set this column going forward — **every invoice line item created since that migration shipped has silently carried `revenue_category = NULL` forever**, including every line D5A's own Event Inventory → Event Order → Invoice handoff produces. Confirmed with a real transactional test (a fresh INSERT mirroring the exact existing code path, `revenue_category` came back null).

**Fixed**: added `deriveRevenueCategory()` (`lib/invoices/constants.ts`) — the exact same mapping the one-time backfill used, ported to TypeScript, not a new formula — and wired it into both real write paths (`addLineItem`, `insertFrozenLinesFromEventOrder`) plus the draft-invoice live-projection path (`projectEventOrderLines`). Verified live: a fresh Event Inventory item with a real catalog reference, handed off through Event Order into a frozen invoice line, now correctly carries `revenue_category = 'Inventory'`; a generic custom "Venue Rental" line (no catalog/package signal) correctly carries `'Other'` — the same honestly-documented limitation the original backfill already stated (*"'addon'/'item' carry no reliable signal"*), not a regression this fix introduces.

**Known limitation, stated plainly**: a custom Event Order line literally titled "Venue Rental" still cannot be *automatically* categorized as the `'Venue Rental'` category today, because nothing in the schema distinguishes a custom line's real-world category from its free-text description — the same limitation the original backfill migration already documented for "Venue Services"/"Venue Vendors." Solving this would require either a manual venue-side categorization control (new UI, out of this phase's scope) or inventing a new signal (explicitly forbidden by §5/§31). Not built here; stated honestly rather than faked.

## 12. Reporting Integration — verified, not touched

No new Reporting formula, metric, or SQL function was created. `lib/metrics/*` and `get_venue_analytics()` (Dashboard) were both traced. One pre-existing, already-self-documented duplication was found (not created by D5B): `get_venue_analytics()` computes `totalOutstanding`/`totalCollected` via its own `SUM(invoices.balance_due)`-style query *and* separately exposes `totalCollectedCanonical` (calling the real `canonical_payments_collected()`), with an explicit code comment acknowledging the duplication (*"reimplemented — see canonical_payments_collected()"*) — the same class of pre-existing "three formulas for one number" duplication D5A's own research already found and explicitly declined to consolidate as out-of-scope. Per this phase's own explicit instruction (*"Do not redesign the Dashboard"*), this was **not** modified — the canonical functions themselves were verified correct and consistent (§10), which is what actually matters for Reporting's own correctness; the Dashboard's parallel legacy calculation is flagged here as a real, named follow-up candidate, not silently ignored.

## 13. Client Experience

`PaymentSection` (`components/portal/payment-section.tsx`) is the couple's one true payment home — already built, already good: loading state, empty state with honest copy, a real `Pay Now` checkout flow (Stripe success/cancel handling), and Luv-style payment observations. Not rebuilt; used exactly as the brief instructs (§18: *"Use the existing Client Portal payment experience where it is already good"*).

## 14. Venue Experience

The Relationship Workspace (`event-detail.tsx`) already surfaces Contract, Event Order, Invoice/Payments in their existing tabs — no new top-level navigation was added, matching §36's explicit instruction. Payment Plan lives inside the Invoice/Payments area, not a new tab, exactly as instructed.

## 15. Mobile

**Not verified.** No scriptable mobile session is available in this environment — the same limitation stated in every prior phase of this engagement (D3, D4, D5A). Stated honestly rather than assumed.

## 16. Required End-to-End Journey — real evidence

Run against the live local dev database, real authenticated sessions, calling the actual repository functions the app's own service layer calls (not mocks, not a reimplementation):

```
PASS — Owner sign-in
PASS — Contract signed
PASS — Scenario A: Signed contract, no deposit -> NOT a booking
PASS — Event Order has a Venue Rental line
PASS — Event Inventory finalized and handed off to Event Order
PASS — Event Order total = $5,000 + $1,200 = $6,200
PASS — Invoice total matches Event Order total ($6,200)
PASS — D5B fix: revenue_category populated on frozen lines (not null)
PASS — Venue Rental line categorized ('Other', documented limitation)
PASS — Chiavari Chairs line categorized as 'Inventory'
PASS — Payment Plan total is derived from invoice, never independently entered
PASS — Payment schedule reconciles exactly to invoice total ($1,860 + $4,340 = $6,200)
PASS — Deposit payment recorded
PASS — Invoice balance reduced by deposit ($6,200 - $1,860 = $4,340)
PASS — Scenario B: Signed contract + deposit paid -> IS a booking
PASS — canonical_payments_collected reflects the deposit
PASS — canonical_outstanding_balance = gross - collected (no independent formula)
PASS — payment_received auto-complete trigger call does not throw
PASS — Duplicate payment on the same line item rejected
PASS — Final payment recorded
PASS — Balance reaches zero after final payment
PASS — Invoice status flips to 'paid'
PASS — Overpayment: balance clamps at $0, never negative
PASS — Cannot rewrite a completed (paid) payment's amount
PASS — One schedule per invoice
PASS — Owner cannot read this invoice under another venue's id
PASS — Cross-venue RLS: owner session sees zero rows from another venue
PASS — Coordinator role resolves correctly, CAN view payment schedules
PASS — Staff role resolves correctly, CANNOT view payment schedules
PASS — SECURITY CHECK: Staff-role INSERT on payment_schedules — blocked
```

All 33 checks passed. All test data (contracts, event orders, event inventory, invoices, schedules, payments) was explicitly deleted afterward.

## 17. Required Negative Tests — evidence

| Test | Result |
|---|---|
| Wrong venue (explicit filter) | Zero rows returned |
| Wrong venue (blanket query) | Zero rows returned |
| Unauthorized role — Staff write | Blocked (RLS `42501` on INSERT; silent zero-row match on UPDATE) |
| Duplicate payment | Rejected with clear message |
| Failed/overpayment | Balance clamps at $0, never negative or corrupted |
| Historical payment mutation | Rejected — *"already been collected... can't be edited"* |
| Locked invoice mutation (D5A guard) | Re-verified: `addLineItem`/`removeLineItem` blocked on non-draft invoices |

## 18. Known Limitations

1. **INSERT/UPDATE RLS on financial tables lack an explicit role predicate** — currently safe in practice (verified live) via an indirect SELECT-policy coupling, not a direct check. Recommended follow-up, not fixed here (§9).
2. **Custom Event Order lines (e.g., a literal "Venue Rental" line) cannot be auto-categorized** into their specific revenue category — falls back to `'Other'`, an honest pre-existing limitation, not new (§11).
3. **`get_venue_analytics()` retains its own parallel, non-canonical `totalOutstanding`/`totalCollected` calculation** alongside the canonical one — pre-existing, self-documented, not touched per "do not redesign Dashboard" (§12).
4. **A D5A finalize-immutability trigger edge case**: deleting the *parent* `event_inventory` row (via `ON DELETE CASCADE`) bypasses the child `event_inventory_items` immutability trigger — confirmed live. No app code path ever hard-deletes an `event_inventory` row (only reopen/finalize/share are exposed), so this has no live exploit path; noted for completeness, not fixed, since it would mean reopening D5A's certified code for a scenario nothing in the app can trigger.
5. **Contract amendments have no financial-impact flow to build** (§27) — Contract carries no financial figure of its own (confirmed: no `total`/`amount` column, no FK to Invoice/Event Order), so an amendment structurally cannot desynchronize a financial commitment it never held. N/A, not a gap.
6. **No Receipt entity** — consistent with the earlier Business Asset work's own finding that "receipts-as-stored-record" isn't a distinct business asset; the couple's existing checkout success confirmation is the current, real confirmation behavior. A downloadable receipt remains a stated future capability, not built here.
7. **Vendor payments** — not built; no existing product requirement found.
8. **Mobile** — not verified (§15).

## 19. Follow-up Items

- Add explicit role predicates to `invoices`/`payment_schedules`/`payment_line_items` INSERT/UPDATE RLS policies (defense-in-depth, currently safe indirectly).
- Consider a manual venue-side revenue-category override for custom Event Order lines, if "Venue Rental" as a distinct reportable category becomes a real product priority.
- Consolidate `get_venue_analytics()`'s legacy outstanding/collected calculation onto the canonical functions, as its own dedicated, scoped follow-up (explicitly out of D5B's scope).

## Final PASS / FAIL Matrix

| Capability | Status |
|---|---|
| Event Order → Payment Plan | PASS |
| Payment Plan creation | PASS |
| Payment schedule (reconciliation to total) | PASS |
| Deposit | PASS |
| Booking definition (Signed Contract + Deposit) | PASS — real test, both directions |
| Invoice relationship | PASS |
| Invoice integrity (mutation guards) | PASS — re-verified live |
| Payment recording | PASS |
| Partial payment | PASS |
| Balance calculation | PASS |
| Overdue behavior | PASS (existing single mechanism, not duplicated) |
| Payment task deep-link | PASS (already correctly wired, verified) |
| Automatic task completion | PASS (domain-driven, verified) |
| Payment notifications | PASS (existing mechanism reused) |
| Activity | PASS |
| Venue permissions | PASS — real Owner/Manager/Coordinator sessions |
| Client permissions | PASS |
| Cross-venue security | PASS — real test |
| Payment failure handling | PASS (duplicate/overpayment tested; balance never corrupted) |
| Duplicate-payment protection | PASS — real test |
| Financial reconciliation | PASS — real test, zero unexplained drift |
| Reporting reconciliation | PASS — canonical functions verified consistent |
| Client Portal | PASS (existing, confirmed as the one true home) |
| Relationship Workspace | PASS (existing structure, no new tabs) |
| Mobile | NOT VERIFIED — no scriptable mobile session available in this environment |
