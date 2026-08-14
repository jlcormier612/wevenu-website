# Couple Tasks — Final Payment Verified Completion · Implementation 7

**Date:** 2026-08-09  
**Status:** **IMPLEMENTED — Option B** (durable task → `payment_line_item_id` binding) · **Live QA PASS** (Emma/Jordan, after `source_type` hotfix)  
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

**Env:** `http://localhost:3000` · token `seedcoupleportal00000000000000000000000000000001`  
**Artifacts:** `docs/qa/couple-task-final-payment-impl7/`  
**Date exercised:** 2026-08-10  
**Verdict: PASS (after Impl 7 hotfix for `source_type`)**

### Method

1. Applied migration `20261241000000_couple_final_payment_verified_completion.sql` via `docker exec … psql` (column was missing on local DB).  
2. Emma lines still had `obligation_kind = null` (seeded before migration) → set kinds explicitly to seed intent: installment / installment / final.  
3. Trigger already migrated on couple Final payment task (`d315e9d6-…` → `final_payment_obligation_paid`); `payment_line_item_id` was null.  
4. Bound via domain helper `bindFinalPaymentTaskToLine` → FK `dbb97688-…` (Final Payment line).  
5. Mark-paid through domain path mirroring `markLineItemPaid` / Stripe admin side effects (`repo.markItemPaid` + `triggerAutoComplete` + `completeFinalPaymentTasksBoundToLine` + celebration helpers) — `docs/qa/couple-task-final-payment-impl7/run-domain.mts`.  
6. Portal desktop + mobile Playwright capture — `capture.mjs`.

### Binding state found

| Stage | Lines `obligation_kind` | Final task trigger | `payment_line_item_id` |
| --- | --- | --- | --- |
| After migration only | all `null` | `final_payment_obligation_paid` | `null` |
| After seed-kind align + bind | installment / installment / **final** | `final_payment_obligation_paid` | **bound** to Final Payment line |

### Matrix results

| Step | Result | Evidence |
| --- | --- | --- |
| Before — Final ledger unpaid | **PASS** | Desktop/mobile tasks + payments show Final Payment Pay now; status pending |
| Before — Pay Now → `#payments` | **PASS** | Payments tab schedule lines with Pay now CTAs |
| Before — checklist twin suppressed (`fc843dc`) | **PASS** | Open Tasks show ledger **Final Payment** only; no open checklist **Final payment** twin; API task `canComplete: false` |
| Mark First Installment (non-final) paid | **PASS** | Task stays `pending`; `final_payment_obligation_paid` count **0**; `final_payment_received` **0**; invoice balance 8640.43 |
| Mark typed Final line paid | **PASS\*** | Line `status=paid`; obligation Luv **1**; paid-in-full **0** (Second Installment still overdue — distinguishes A vs B) |
| Final Payment task completes | **PASS\*** | After hotfix: status `complete`, `source_type=payment`, checklist **9/10** |
| Payment attention resolves for Final | **PASS** | Open Tasks: only Second Installment Pay now remains |
| One Luv `final_payment_obligation_paid` | **PASS** | Count stays **1** |
| No false `final_payment_received` from obligation alone | **PASS** | Count **0** while invoice incomplete |
| Refresh / remake helpers | **PASS** | Remake mark-paid rejected already-paid; re-celebrate false; celebration still **1**; task remains complete; no synthetic reopen |

\*First mark-final attempt set the line paid + fired obligation Luv but **failed to complete the task** — see hotfix below. Re-ran `completeFinalPaymentTasksBoundToLine` after fix → complete.

### Desktop + mobile

| Check | Desktop | Mobile |
| --- | --- | --- |
| Before twin suppress + 3 Pay now | Pass | Pass |
| After first: Final still open Pay now; no obligation celeb | Pass | Pass |
| After final+fix: Final gone from open; Second Pay now only | Pass | Pass |
| After refresh: stable complete / no duplicate celeb | Pass | Pass |

Screenshots: `docs/qa/couple-task-final-payment-impl7/01-*-desktop-*.png`, `02-*-mobile-*.png` · summaries: `qa-results-*.json`, `domain-*.json`, `qa-results.json`.

### Hotfix discovered in Live QA (committed with this pass)

`completeEventTask(..., sourceType: "payment_line_item")` violated `event_tasks_source_type_check` (allowed: `payment`, not `payment_line_item`). Updates failed silently (no error thrown), so Option B completion appeared to no-op.  
**Fix:** use `source_type: "payment"` in `final-payment-obligation.ts`, `service.ts` mark-paid, and Stripe webhook; throw on `completeEventTask` update error.

---

## 13. Files changed

| File | Change |
| --- | --- |
| `supabase/migrations/20261241000000_couple_final_payment_verified_completion.sql` | Schema + safe trigger migrate + Luv CHECK |
| `supabase/seed.sql` | Emma lines set `obligation_kind` explicitly |
| `lib/payments/final-payment-obligation.ts` | Bind / complete-by-line / celebrate helpers; **Live QA fix:** `source_type=payment` |
| `lib/payments/final-payment-obligation.test.ts` | Acceptance matrix |
| `lib/payments/{types,constants,validation,repository,service}.ts` | Kinds, create/regenerate/retainer/manual, mark-paid side effects; **source_type fix** |
| `lib/stripe/webhook-handlers.ts` | Same narrow complete + obligation Luv; **source_type fix** |
| `lib/playbooks/{constants,types,repository}.ts` | Trigger list + template + `paymentLineItemId`; **throw on complete update error** |
| `lib/portal/unified-tasks.ts` | Route + twin suppress for new trigger |
| `lib/portal/unified-tasks.test.ts` | Final mirror uses new trigger |
| `lib/luv/{celebrations,verified-domain-celebrations}.ts` (+ tests) | New celebration type + copy |
| `components/payments/{payment-schedule-detail,schedule-review-banner}.tsx` | Explicit kind UI; dual celebrate flags |
| `docs/qa/couple-task-final-payment-verified-completion-implementation-7.md` | This report |
| `docs/qa/couple-task-final-payment-impl7/*` | Live QA harness + screenshots + domain snapshots |

---

## 14. Commit hash

**Implementation:** `15683e8` — `feat: Final Payment verified completion via Option B line binding`  
**Stamp commits:** `c1e79c3` / `927be53`  
**Live QA + source_type hotfix:** see git log after this doc update (local only; not pushed).

Prior STOP docs: `6345ba4` / `b63d028` remain intact.

---

## Residual risks

1. **Pre-existing schedules with null kinds** — Final Payment tasks stay unbound until a typed `final` line is created/regenerated; paying a legacy unlabeled “Final Payment” line will **not** complete the verified task (by design — no label inference).  
2. **Multi-invoice events** — Multiple finals OK; each binds a separate unbound task if present. If only one Final Payment task exists, only the first unbound bind wins; later finals have no task until another Final Payment task exists.  
3. **Luv uniqueness is per client** — Second final obligation on same client does not celebrate again (same pattern as other couple Luv types).  
4. **Seed bind gap** — Seed sets kinds but does not create/bind `event_tasks` in `seed.sql`; binding occurs when schedule create/add/regenerate runs against an applied playbook.
