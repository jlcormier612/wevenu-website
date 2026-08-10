# Couple Tasks — Final Payment Verified Completion · Implementation 7

**Date:** 2026-08-09  
**Status:** **IMPLEMENTED — Option B** (durable task → `payment_line_item_id` binding)  
**Mode:** Product implementation after Option B approval.

**Priors (must remain intact):**  
`5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`, `8d52f38`, `192c728`, `d2be260`, `23e5c13`, `6345ba4`

**Rule:** ONLY COMPLETE / CELEBRATE WHAT THE SYSTEM CAN PROVE. Navigation/refresh never complete. Never infer Final from label at completion.

---

## 1. Original STOP (accepted — `23e5c13` + prior STOP doc)

- `payment_line_items.label` is free text — not identity  
- `payment_received` = any payment on the event — too broad for Final Payment task  
- Luv `final_payment_received` = event invoices paid in full — not “Final Payment line paid”  
- Couple “Final payment” template previously used `autoCompleteTrigger: "payment_received"` (same as coordinator “Verify deposit”)  
- Multiple `final`-typed lines per event are possible (one schedule per invoice × multiple invoices)

---

## 2. Approved model (Option B — built)

| # | Decision | Implementation |
| --- | --- | --- |
| 1 | Durable `obligation_kind` on lines | `deposit \| installment \| final \| other`; set at creation; nullable legacy |
| 2 | Identity = task → line FK | `event_tasks.payment_line_item_id` → `payment_line_items.id` |
| 3 | Verify = that line `status=paid` | Complete-by-line-id helper; not label |
| 4 | Keep `payment_received` broad | Still fired on every mark-paid / Stripe success |
| 5 | Couple Final does **not** use `payment_received` as proof | Trigger → `final_payment_obligation_paid` |
| 6 | New celebration ≠ paid-in-full | `final_payment_obligation_paid` Luv type |
| 7 | One-shot via unique constraint | Insert-only; `celebrated` / `obligationCelebrated` only on first win |
| 8 | Preserve `fc843dc` twin suppression | Also suppress new Final trigger while unpaid lines exist |
| 9 | No historical label backfill to `final` | Forward-only typing; seed sets kinds explicitly |

---

## 3. Payment obligation SoT

| Fact | Source of truth |
| --- | --- |
| A schedule line exists | `payment_line_items.id` |
| That line’s role | `payment_line_items.obligation_kind` (set at create; never from label at complete) |
| That line is paid | `status = 'paid'` (Stripe / manual mark-paid) |
| Which Final Payment task owns which line | `event_tasks.payment_line_item_id` (Option B) |
| Couple Final Payment auto-complete trigger | `auto_complete_trigger = 'final_payment_obligation_paid'` |
| Remaining Pay Now attention | Canonical unpaid lines (`selectCanonicalPaymentSchedules`) |
| Event paid in full | Invoice readiness `complete` → Luv `final_payment_received` (unchanged) |

---

## 4. `obligation_kind` semantics

| Kind | Meaning | Creation sources |
| --- | --- | --- |
| `deposit` | Deposit / retainer | Preset first lines; retainer shortcut (always deposit, never final) |
| `installment` | Mid-plan payment | Preset middle lines |
| `final` | Final Payment obligation for that schedule | Preset last lines only |
| `other` | Explicit non-classified add | Manual create when coordinator chooses Other |
| `null` | Legacy / untyped | Pre-migration rows; **not** treated as final |

**Never** infer `final` from label at completion time. Manual create **requires** an explicit kind.

---

## 5. Migration

**File:** `supabase/migrations/20261241000000_couple_final_payment_verified_completion.sql`

1. `payment_line_items.obligation_kind` + CHECK (`deposit|installment|final|other` or null)  
2. `event_tasks.payment_line_item_id` nullable FK → `payment_line_items(id)` **ON DELETE SET NULL**  
3. Widen `luv_celebrations.celebration_type` → `final_payment_obligation_paid`  
4. Safe trigger migrate (couple Final payment only):

```sql
-- playbook_tasks + event_tasks where:
--   auto_complete_trigger = 'payment_received'
--   AND owner_type = 'couple'
--   AND lower(trim(title)) = 'final payment'
-- → final_payment_obligation_paid
-- Does NOT touch coordinator "Verify deposit"
```

**Historical strategy:** Do **not** backfill `obligation_kind = 'final'` from labels. Legacy lines stay null. Existing unbound Final Payment tasks bind when a new typed `final` line is created/regenerated for that event. Emma seed sets kinds explicitly for **new** seeds.

---

## 6. Verification path

1. Coordinator/Stripe marks a line paid (`status=paid`).  
2. Always fire `triggerAutoComplete(..., "payment_received", ...)` (broad).  
3. Additionally `completeFinalPaymentTasksBoundToLine(lineId)` — completes open tasks where `payment_line_item_id = lineId` **and** trigger = `final_payment_obligation_paid`.  
4. If paid line’s `obligation_kind = 'final'`, insert Luv `final_payment_obligation_paid` (first win).  
5. Separately, if invoices readiness is complete, insert Luv `final_payment_received` (unchanged).

**Does not complete on:** navigate, refresh, render, refetch, Mark complete (disabled), deposit/installment/other paid lines (unless those lines are somehow bound — binding only runs for `obligation_kind=final`).

---

## 7. Task auto-complete + binding

**Trigger name:** `final_payment_obligation_paid`  
**Template:** Client Planning “Final payment” uses this trigger (reference seed + migration for existing rows).

**Binding (deterministic):** When inserting a line with `obligation_kind = 'final'`:

1. Find open `event_tasks` on that event with trigger `final_payment_obligation_paid` and `payment_line_item_id IS NULL`  
2. Order by `sort_order ASC`, then `id ASC`  
3. Bind the first to the new line id  

Multiple finals ⇒ each new final binds the next unbound Final Payment task.  
On regenerate: deleting unresolved lines SET NULLs the FK; new finals rebind unbound tasks.

**Manual Mark complete:** remains disabled (`completableHere: false`) for the verified trigger.

---

## 8. New celebration

| Item | Value |
| --- | --- |
| Type | `final_payment_obligation_paid` |
| Gate | `luv_celebrations` unique `(client_id, celebration_type)` |
| When | First time a typed `final` line is marked paid |
| UI flag | `obligationCelebrated: true` on mark-paid result (coordinator toast) |
| Not from | React completed-state effects, navigation, render |

Distinct from `final_payment_received` (paid-in-full).

---

## 9. Paid-in-full untouched

- Luv type `final_payment_received` unchanged  
- Still driven by `computePaymentsReadiness(...).status === "complete"`  
- Return field `celebrated` still means paid-in-full  
- Paying only non-final lines can still fire paid-in-full without claiming Final **obligation** paid  
- Paying a typed final fires obligation Luv; paid-in-full only if invoices are complete

---

## 10. Attention preservation (`fc843dc`)

- Unpaid canonical lines → ledger owns **Pay now**  
- Suppress incomplete checklist mirrors for:
  - `payment_received` (Impl 2)
  - `final_payment_obligation_paid` (Impl 7 — prevents Final Payment twin beside Pay now)
- Do **not** delete underlying `event_tasks`  
- Once bound final is paid → task completes → attention resolves  
- Non-payment domain tasks remain alongside unpaid lines

---

## 11. Tests

```bash
npx tsx --test \
  lib/payments/final-payment-obligation.test.ts \
  lib/luv/celebrations.test.ts \
  lib/luv/verified-domain-celebrations.test.ts \
  lib/portal/unified-tasks.test.ts \
  lib/portal/next-steps.test.ts \
  lib/portal/workspace-routing.test.ts
```

**Result: 77/77 pass** (Impl 7 acceptance matrix + Impl 1–4 / payment-attention suites).

Acceptance coverage: deposit/installment/other unpaid suppress; final unpaid suppress; final paid complete row; multi-line; paid-in-full ≠ obligation; `completableHere` false; pure refresh; presets/kinds; Verify deposit still broad; celebration naming distinct.

---

## 12. Live QA (Emma / Jordan)

**Not fully runnable in this pass.** Local app/migration apply for mark-paid against Emma seed was not exercised end-to-end here (no fresh portal mark-paid harness run against applied `20261241000000`).  

**Automated substitute:** 77 unit tests covering binding rules, attention, triggers, and celebration identity.  

**Recommended live smoke after `supabase db reset` / migration apply:**

1. Confirm Emma thirds lines have `obligation_kind` installment/installment/final  
2. Confirm couple Final payment task trigger = `final_payment_obligation_paid`  
3. Bind via regenerate schedule or create new final line (seed kinds alone don’t attach FK until bind path runs)  
4. Mark deposit paid → Final task pending; no obligation Luv  
5. Mark final paid → task complete; `obligationCelebrated` once; Pay now for that line gone  
6. Repeat mark / refresh → no second celebration; no side-effect complete  

---

## 13. Files changed

| File | Change |
| --- | --- |
| `supabase/migrations/20261241000000_couple_final_payment_verified_completion.sql` | Schema + safe trigger migrate + Luv CHECK |
| `supabase/seed.sql` | Emma lines set `obligation_kind` explicitly |
| `lib/payments/final-payment-obligation.ts` | Bind / complete-by-line / celebrate helpers |
| `lib/payments/final-payment-obligation.test.ts` | Acceptance matrix |
| `lib/payments/{types,constants,validation,repository,service}.ts` | Kinds, create/regenerate/retainer/manual, mark-paid side effects |
| `lib/stripe/webhook-handlers.ts` | Same narrow complete + obligation Luv as mark-paid |
| `lib/playbooks/{constants,types,repository}.ts` | Trigger list + template + `paymentLineItemId` |
| `lib/portal/unified-tasks.ts` | Route + twin suppress for new trigger |
| `lib/portal/unified-tasks.test.ts` | Final mirror uses new trigger |
| `lib/luv/{celebrations,verified-domain-celebrations}.ts` (+ tests) | New celebration type + copy |
| `components/payments/{payment-schedule-detail,schedule-review-banner}.tsx` | Explicit kind UI; dual celebrate flags |
| `docs/qa/couple-task-final-payment-verified-completion-implementation-7.md` | This report |

---

## 14. Commit hash

**Implementation:** `15683e8` — `feat: Final Payment verified completion via Option B line binding`  
**Stamp commit:** _(this docs stamp)_

Prior STOP docs: `6345ba4` / `b63d028` remain intact.

---

## Residual risks

1. **Pre-existing schedules with null kinds** — Final Payment tasks stay unbound until a typed `final` line is created/regenerated; paying a legacy unlabeled “Final Payment” line will **not** complete the verified task (by design — no label inference).  
2. **Multi-invoice events** — Multiple finals OK; each binds a separate unbound task if present. If only one Final Payment task exists, only the first unbound bind wins; later finals have no task until another Final Payment task exists.  
3. **Luv uniqueness is per client** — Second final obligation on same client does not celebrate again (same pattern as other couple Luv types).  
4. **Seed bind gap** — Seed sets kinds but does not create/bind `event_tasks` in `seed.sql`; binding occurs when schedule create/add/regenerate runs against an applied playbook.
