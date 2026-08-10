# Couple Tasks — Final Payment Verified Completion · Implementation 7

**Date:** 2026-08-09  
**Status:** **STOPPED — Phase 1 inspection only. No implementation. No behavioral commit.**  
**Mode:** Investigation-first per WP (inspect before code). User authorized implement-only-if-safe.

**Priors (must remain intact — not mutated this pass):**  
`5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`, `8d52f38`, `192c728`, `d2be260`

---

## Verdict

**Not safely implementable** with the current payment domain.

The system cannot prove:

> “This event’s **Final Payment obligation** (the specific schedule line) has been paid.”

without inventing semantics the schema does not carry.

Per WP STOP rules **1, 5, and 6**, implementation is blocked. Existing attention suppression from `fc843dc` stays as designed; `payment_received` must not be narrowed into a Final Payment stand-in by reinterpreting it.

---

## 1. Payment-domain inspection findings

### Line / item schema (`payment_line_items`)

From `supabase/migrations/20260626320000_payments_foundation.sql` (+ Stripe / QB columns later):

| Field | Present? | Useful for Final Payment identity? |
| --- | --- | --- |
| `id`, `schedule_id`, `venue_id` | Yes | Identity of a line, not its *role* |
| `label` (free text) | Yes | **Not allowed** as completion SoT (title/label matching) |
| `amount`, `due_date`, `status`, `paid_at`, `paid_amount` | Yes | Proof a *line* is paid, not that it is Final |
| `sort_order` | Yes | Ordering ≠ Final Payment role |
| `kind` / `obligation_type` / `is_final` / enum | **No** | Missing |

Presets in `lib/payments/constants.ts` (`SCHEDULE_PRESETS`) only stamp **human labels** (“Deposit (50%)”, “Final Payment”, “First Installment”, …). Those strings are not durable domain types.

### Canonical schedule selection

`selectCanonicalPaymentSchedules` / `remainingBalanceFromSchedules` (`lib/portal/payment-schedules.ts`) choose which **schedule(s)** count for couple attention / remaining balance. They do **not** classify deposit vs installment vs final lines.

### How “Final Payment” appears today

| Surface | Mechanism |
| --- | --- |
| Couple Pay Now attention | Unpaid **canonical** `payment_line_items` → `kind: "payment"` (Impl 2) |
| Couple checklist “Final payment” | `event_tasks` with `auto_complete_trigger = 'payment_received'` (Client Planning template) |
| Twin suppression (`fc843dc`) | Hide incomplete `payment_received` mirrors while any unpaid canonical line exists — gate is **trigger field**, not title |

There is **no FK** from `event_tasks` → `payment_line_items`.

### Payment success path

`markLineItemPaid` (`lib/payments/service.ts`) and Stripe `handlePaymentIntentSucceeded`:

1. Mark line paid  
2. Activity `payment_received`  
3. `triggerAutoComplete(..., "payment_received", "payment_line_item", itemId)` — **all** open event tasks with that trigger on the event  
4. Separately: if `computePaymentsReadiness(event invoices).status === "complete"`, insert Luv `final_payment_received`

### Triggers

| Trigger / celebration | Meaning today |
| --- | --- |
| `payment_received` | **Any** line paid on the event — “Any payment received” in playbook UI (`lib/playbooks/constants.ts`) |
| Coordinator “Verify deposit” | Also `payment_received` (coordinator_only) |
| Couple “Final payment” | Also `payment_received` — **same trigger as deposit verification** |
| `final_payment_received` (Luv) | Event invoices **paid in full** (`balanceDue` sum = 0) via `computePaymentsReadiness` — **not** “Final Payment line paid” |

Verified-domain map (`lib/luv/verified-domain-celebrations.ts`) correctly does **not** map `payment_received` to a celebration (over-broad).

---

## 2. Exact Final Payment SoT — **missing**

There is **no** durable typed Final Payment obligation in the ledger.

What exists instead:

- Free-text line `label` (often “Final Payment” by preset/convention)
- Template title “Final payment” on a checklist row that listens to `payment_received`
- Event-level invoice readiness “Paid in full”

None of these is a reliable Final Payment obligation identifier.

---

## 3. Exact relationship proving Final Payment was paid — **not available**

Preferred chain from the WP:

```text
payment transaction / paid ledger line
        ↓
specific canonical Final Payment line/schedule
        ↓
verified Final Payment completion signal
        ↓
specific Final Payment task completion
        ↓
one-time Luv celebration
```

**Break:** there is no “specific canonical Final Payment line” typed in the schema, and no edge from paid transaction → Final Payment *role*. Paying line `id=X` proves line X paid; it does not prove X is Final without label/order heuristics.

---

## 4. Old `payment_received` behavior

- Fired on **every** successful mark-paid / Stripe succeed for a line item  
- Completes **every** open `event_tasks` row with `auto_complete_trigger = 'payment_received'` on that event  
- Includes couple “Final payment” **and** (for coordinators) “Verify deposit”  
- Therefore: **Deposit paid → would complete Final Payment task if that task were not suppressed from attention / or when no unpaid lines remain for twin hide / after attention returns**

Impl 2 **suppresses** the checklist mirror from Home/Tasks attention while unpaid lines exist, but does **not** stop `triggerAutoComplete` from completing the checklist on deposit if that path runs while the row is still pending.

Wiring Final Payment task completion to `payment_received` remains **unsafe**.

---

## 5. Why existing `final_payment_received` cannot be reused (STOP #6)

`final_payment_received` means:

> All invoices for the event have `balanceDue === 0` (readiness `complete`).

That is **event paid-in-full**, which is:

- Broader than “the Final Payment line was paid”  
- Equivalent to “last remaining balance cleared” — WP forbids substituting “last payment” unless the domain **explicitly** defines that as Final Payment (it does not)  
- Fires on the payment that zeroes the invoice(s), even if that line’s label is Installment / Other / Deposit-only retainer  
- Already used as a **celebration**, not as `triggerAutoComplete` for couple tasks

Reusing it to auto-complete the couple “Final payment” task would invent a false equivalence.

---

## 6–9. Task / celebration / attention / multi-installment

| Topic | Finding under STOP |
| --- | --- |
| Auto-complete Final Payment task | **Not implemented** — no safe signal |
| Celebration | Must not celebrate Final Payment task via `payment_received`; must not overload paid-in-full Luv as line-final without schema |
| Payment attention (`fc843dc`) | Unchanged; still correct twin suppression |
| Multi-installment | Without line roles, deposit vs installment vs final cannot be distinguished for completion |

---

## 10–11. Automated tests / Live QA

**Not run as an implementation suite** (no code path added).  

Prior suites (`fc843dc` payment-attention cases in `lib/portal/unified-tasks.test.ts`) remain the regression baseline for twin suppression and must stay green when a future approved model lands.

---

## 12. Files changed

**None** (product). This file only.

---

## 13. Commit hash

**None** for implementation (STOP). Optional docs-only commit may stamp this report separately.

---

## STOP conditions triggered

| # | Condition | Hit? |
| --- | --- | --- |
| 1 | Cannot reliably identify Final Payment | **Yes** — no typed line role |
| 2 | Partial payment + unclear full satisfaction of Final | **Yes / related** — no Final line to fully-satisfy; paid-in-full is invoice-level |
| 3 | Canonical schedule vs paid transaction relationship for Final | **Yes** — paid transaction → line id only; no Final role |
| 4 | Larger financial redesign required | **Yes** — need typed obligation |
| 5 | Only heuristic/title/amount/order available | **Yes** — labels / sort_order / “last unpaid” |
| 6 | `final_payment_received` broader than Final Payment | **Yes** — paid-in-full |

---

## Smallest truthful domain change (proposal — **not built**)

Approve before any migration / trigger wiring.

1. **Add a durable line role** on `payment_line_items`, e.g.  
   `obligation_kind text null` with allowed values such as  
   `'deposit' | 'installment' | 'final' | 'other' | 'retainer'`  
   (exact enum TBD with product).  
   - Set when applying `SCHEDULE_PRESETS` / creating retainer / coordinator create-line UI (explicit pick; **never** infer from label at completion time).  
   - Existing rows: backfill only via explicit scripts or leave null (null ≠ final).

2. **Add playbook trigger** e.g. `final_payment_received` (or `payment_final_paid`) meaning:  
   a paid line on a canonical schedule for this event with `obligation_kind = 'final'` (and status paid / domain-paid).  
   - Couple “Final payment” template uses **this** trigger, not `payment_received`.  
   - Keep `payment_received` as “any payment” for coordinator Verify deposit etc.

3. **On mark-paid / Stripe succeed:**  
   - Always keep `payment_received` for true any-payment consumers.  
   - **Additionally** if the paid line’s `obligation_kind = 'final'`, fire the narrow trigger + map celebration to existing Luv type `final_payment_received` **only if** product confirms that celebration should mean line-final (vs paid-in-full).  
   - If product wants to **keep** paid-in-full celebration semantics under the same type name, introduce a **new** celebration type for line-final (e.g. `final_payment_line_paid`) so paid-in-full and line-final are not conflated.

4. **Preserve `fc843dc`:**  
   Twin suppression continues to key on `payment_received` mirrors while unpaid canonical lines exist.  
   After Final line typed, optionally also suppress the new final-trigger mirror the same way, or retire couple mirror once Pay Now owns the attention (product call).

5. **Partial pay:** only mark Final task complete when domain says the **final line** is fully paid (existing `status = paid` semantics), not when another kind is paid.

Until approved: do **not** change Stripe, schedules amounts, or reinterpret `payment_received` / paid-in-full Luv.

---

## Confirmation

- No payment processing / Stripe / schedule amount changes  
- No Wedding Website / Collections / Photo Styles / Share Timeline / Insurance / RSVP changes  
- No inventive completion  

**Next step:** Approve (or revise) the typed `obligation_kind` model + trigger/celebration split, then implement under that approval only.
