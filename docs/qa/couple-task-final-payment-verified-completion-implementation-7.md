# Couple Tasks — Final Payment Verified Completion · Implementation 7

**Date:** 2026-08-09  
**Status:** **STOPPED — uniqueness / identity ambiguity after approved-model Phase 1.** No product implementation.  
**Mode:** Approved model inspected in foreground; coding deferred per STOP condition #1 (user confirmed: report ambiguity).

**Priors (must remain intact — not mutated this pass):**  
`5657066`, `0ad64af`, `fc843dc`, `358153b`, `56e98a4`, `8d52f38`, `192c728`, `d2be260`

**Prior investigation (accepted):** commit `23e5c13` — system cannot prove Final Payment obligation paid (no typed line role; `payment_received` too broad; Luv `final_payment_received` = paid-in-full).

---

## Verdict

`obligation_kind` typing is the correct direction and is **not sufficient by itself** to identify “the event’s Final Payment obligation.”

An event can already have **more than one** line that would truthfully receive `obligation_kind = 'final'` (one per invoice payment plan from presets, plus coordinator-added lines). There is **no existing event-level canonical Final Payment identity**.

Per approved WP STOP #1: **do not invent a heuristic. STOP.**

Also: historical rows have **no authoritative non-label field** to backfill `final` (STOP #3 related). Forward-only typing is fine for new creates; classifying legacy as `final` from labels must not happen.

---

## 1. Original STOP finding (accepted — `23e5c13`)

- `payment_line_items.label` is free text — not identity  
- `payment_received` = any payment on the event — too broad for Final Payment task  
- Luv `final_payment_received` = event invoices paid in full via `computePaymentsReadiness` — not “Final Payment line paid”  
- Couple “Final payment” template currently uses `autoCompleteTrigger: "payment_received"` (same as coordinator “Verify deposit”)

---

## 2. Approved model (reviewed, not built)

| # | Approval | Status after inspection |
| --- | --- | --- |
| 1 | Add `payment_line_items.obligation_kind` (`deposit` \| `installment` \| `final` …) at creation | Directionally sound; **blocked until uniqueness resolved** |
| 2 | Verify Final Payment only when typed `final` line is paid | Needs unique target SoT first |
| 3 | Keep `payment_received` broad | Confirmed must remain intact |
| 4 | Narrow verified signal for Final Payment task | Blocked on #1 uniqueness |
| 5 | Prefer no task→line FK if event-level final is unique | **Fails uniqueness test — see §5** |
| 6 | Separate celebration from paid-in-full (`final_payment_obligation_paid`) | Still required when unblocked |
| 7–8 | One-time `luv_celebrations`; preserve `fc843dc` twin suppression | Unchanged intent |
| 9 | Safe creation / migration only | Secondary STOP on historical backfill |

---

## 3. Payment obligation SoT (current)

| Fact | Source of truth today |
| --- | --- |
| A schedule line exists | `payment_line_items.id` |
| That line is paid | `status = 'paid'` (+ Stripe/manual mark-paid paths) |
| Remaining couple Pay Now attention | Canonical unpaid lines via `selectCanonicalPaymentSchedules` |
| Checklist “Final payment” | `event_tasks` with `auto_complete_trigger = 'payment_received'` — **not** wired to a specific line |
| Event paid in full | Invoice readiness `complete` → Luv `final_payment_received` |

**Missing:** durable typed role on the line **plus** a defined event-level (or task-level) identity when multiple `final` lines can exist.

---

## 4. Creation paths inspected (kinds would be assignable forward)

| Path | File / area | If kinds were added today |
| --- | --- | --- |
| Schedule presets | `SCHEDULE_PRESETS` in `lib/payments/constants.ts` → `createPaymentSchedule` / `regeneratePaymentSchedule` | Each preset item can carry an authoritative `obligation_kind` at create (not inferred from label later). Presets currently stamp one Final-labeled item **per schedule**. |
| Retainer shortcut | `createRetainerInvoiceAndSchedule` | Single “Retainer” line → should be `deposit` (or explicit `retainer` if enum allows), **not** `final`. |
| Manual add / review installment | `addLineItem` / `addReviewInstallment` + payment UI | Requires explicit coordinator pick of `obligation_kind`. Ambiguous free-text-only add must refuse or leave non-`final` (not guess). |
| Seed Emma/Jordan | `supabase/seed.sql` thirds plan | Three lines; third is conventionally Final — seed can set kinds explicitly for **new** seeds only. |
| Stripe mark paid | `handlePaymentIntentSucceeded` | Marks **whichever** line id was paid; does not know role until column exists. |

**Uniqueness risk is not “presets invent two finals on one schedule.”** It is **events that hold multiple invoices → multiple schedules → multiple preset finals**, plus **manual adds** of additional `final` lines on any schedule.

---

## 5. STOP #1 — Ambiguity: multiple `final` obligations per event

### Domain fact

Booking financial architecture allows:

- **One payment schedule per invoice** (enforced)  
- **Multiple invoices per event** (allowed — e.g. retainer invoice + main invoice, or additional invoices)  
- Each non-custom preset creates **one** Final-labeled installment on **that** schedule  

Therefore an event can truthfully have:

```text
Event
 ├─ Invoice A / Schedule A → … + Final (would be obligation_kind=final)
 └─ Invoice B / Schedule B → … + Final (would also be obligation_kind=final)
```

`selectCanonicalPaymentSchedules` collapses **duplicate schedules for the same invoice_id**; it does **not** collapse multiple invoices into one Final Payment obligation. After canonicalization, **N invoice plans ⇒ up to N finals**.

There is **no** existing:

- event-level `final_payment_line_item_id`  
- “primary invoice” Final Payment pointer  
- unique constraint limiting one `final` per event  

Couple playbook has **one** “Final payment” task per event application — not one task per invoice/line.

### Why `obligation_kind='final'` alone is insufficient

| Candidate rule | Why it invents semantics |
| --- | --- |
| Complete when **any** typed final is paid | Completes the event checklist while another invoice’s Final remains unpaid |
| Complete when **all** typed finals are paid | Different product meaning; not in approval; still no single “the” Final |
| Prefer newest / largest / last-due final | Ordering / amount heuristic — forbidden |
| Prefer line whose label contains “Final” | Label matching — forbidden |
| Use paid-in-full Luv | Conflates A with B — forbidden |

**No durable task↔line FK exists today**, and the approval said: only add one if required. After uniqueness fails, a durable relationship **is** required before safe completion wiring.

---

## 6. Secondary STOP — historical backfill

| Source | Safe to classify as `final`? |
| --- | --- |
| Free-text `label` | **No** (explicit forbid) |
| `sort_order` last on schedule | **No** (order ≠ role) |
| Preset id stored on line | **Not stored** — cannot reconstruct |
| Invoice / schedule metadata | No final-role field |

**Strategy if later unblocked:** column nullable (or non-`final` default); populate **only** on create/regenerate/retainer/manual with explicit kind; leave historical `NULL` ≠ final. Never backfill `final` from label alone. Emma seed / regenerate can set kinds for fixture environments without classifying arbitrary production history.

---

## 7–9. What was *not* built (intentionally)

- No `obligation_kind` migration  
- No new auto-complete trigger  
- No new Luv celebration type  
- No change to `payment_received` or `final_payment_received` paid-in-full semantics  
- No change to `fc843dc` payment-attention twin suppression  
- No Stripe / amount / Event Order / WW Studio / etc. changes  

---

## 10–11. Tests / Live QA

**Not run as an implementation suite** (no code path).  

When unblocked, acceptance matrix from the WP still applies, plus all `fc843dc` cases in `lib/portal/unified-tasks.test.ts`.

---

## 12. Files changed

This report only:

- `docs/qa/couple-task-final-payment-verified-completion-implementation-7.md`

---

## 13. Commit hash

**6345ba4**

---

## STOP conditions (this pass)

| # | Condition (approved WP) | Hit? |
| --- | --- | --- |
| 1 | Multiple Final Payment obligations without canonical identity | **Yes** — multi-invoice finals |
| 2 | Creation paths cannot reliably establish kind | **No for forward** — presets/retainer/manual can carry explicit kind; **yes for guessing ambiguous manual history** |
| 3 | Historical rows cannot be safely classified | **Yes** — no authoritative non-label source |
| 4 | Completion semantics cannot prove final satisfied | Blocked by #1 (cannot name “the” final) |
| 5 | Broader financial redesign required | **No** — a small identity rule is enough |
| 6 | Paid-in-full celebration too coupled | **No if separated** as approved (`final_payment_obligation_paid`) |

---

## Smallest next model change (choose one — do not invent in code)

Approve **exactly one** identity rule before any implementation:

### Option A — Enforce at most one non-cancelled `final` per event

- Partial unique index / service reject when a second `final` would be created  
- Then `obligation_kind='final'` **is** the event-level Final Payment SoT  
- Product cost: multi-invoice events may not each carry a typed Final (second schedule uses `installment` / `other`, or coordinator must cancel the prior final)

### Option B — Durable task → line relationship

- Couple Final Payment task (or event) stores `payment_line_item_id` (or schedule+kind with uniqueness per schedule)  
- Verification = that specific line reaches domain-paid  
- Preserves multi-invoice finals; requires create/apply-playbook + schedule wiring to bind the task

### Option C — Explicit product meaning: “all typed finals on canonical schedules”

- Document that Final Payment task means **every** non-cancelled `final` on canonical schedules is paid  
- Still not “the” singular obligation, but avoids heuristics if product accepts the meaning

### Option D (rejected without product override)

- Any-final / last-due / label / paid-in-full inference — **not recommended**; contradicts WP

**Also confirm when implementing (already approved in spirit):**

1. Preset items include authoritative `obligation_kind` at create/regenerate  
2. Couple template trigger moves off `payment_received` to a narrow trigger (e.g. `final_payment_obligation_paid`)  
3. Keep `payment_received` broad for Verify deposit / other consumers  
4. New Luv type `final_payment_obligation_paid` ≠ existing `final_payment_received` (paid-in-full)  
5. Preserve `fc843dc` twin suppression for unpaid `payment_received` mirrors  
6. Historical: null / non-final only — no label backfill  

---

## Confirmation

- No payment processing / Stripe / schedule amount changes  
- No reinterpretation of paid-in-full Luv  
- No Wedding Website / Collections / Photo Styles / Share Timeline / Insurance / RSVP changes  
- No inventive completion  

**Next step:** Approve Option A, B, or C (or a written variant). Then implement under that identity rule + the approved typed field / celebration split.
