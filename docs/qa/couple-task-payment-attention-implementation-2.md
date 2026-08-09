# Couple Tasks — Payment Attention & Final Payment Twin · Implementation 2

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Source of truth:** `docs/qa/couple-task-verified-action-completion-investigation.md` §Issue 2; `docs/qa/couple-home-polish-investigation.md` Issue 2  
**Related shipped (must remain intact):**  
- `5657066` Home Review CTA  
- `0ad64af` Verified Action Completion Impl 1 (`canComplete=false` for domain-verified; destinations; questionnaire wiring)  
- `c60be1c` payment schedule canonicalization (`selectCanonicalPaymentSchedules`, `remainingBalanceFromSchedules`)

---

## 0. Inspection before coding (no invent)

### 0.1 How payment lines appear in `buildUnifiedTaskList`

Unpaid `payment_line_items` on **canonical** schedules (`selectCanonicalPaymentSchedules`) emit `kind: "payment"` rows:

- `id`: `payment_{lineItemId}`
- `title`: line `label` (e.g. `Final Payment`)
- `targetSection`: `payments`
- `actionLabel`: `Pay now`
- `completableHere`: `false`
- Paid / cancelled lines are omitted

### 0.2 How event_tasks appear

Every portal `PortalTask` from `event_tasks` emits `kind: "venue_task"`:

- `id`: `task_{eventTaskId}`
- Presentation from `venueTaskPresentation` (Impl 1): domain triggers → navigate CTA; no Mark complete when `autoCompleteTrigger` set
- Completed rows still synthesize (`completed: true`); Home/Tasks filter open items for attention

### 0.3 Fields connecting payment-related checklist ↔ payment obligation

| Candidate | Reliable for twin rule? |
| --- | --- |
| Shared DB FK `event_tasks` → `payment_line_items` | **None** |
| Title / case-insensitive title | **No** — insufficient; prohibited |
| `category === "financial"` alone | **No** — too broad; not required |
| `autoCompleteTrigger === "payment_received"` | **Yes** — template + playbook SoT for money-linked checklist mirrors |

**Seed Client Planning “Final payment”:** `autoCompleteTrigger: "payment_received"`, `category: "financial"`, visibility `client_owned`.  
**Live Emma & Jordan:** checklist `d315e9d6-…` + line `dbb97688-…` — conceptually same obligation, different rows/IDs.

**Decision:** Suppress incomplete `venue_task` mirrors with `autoCompleteTrigger === "payment_received"` when **any unpaid canonical payment line** exists for the event. Gate is the trigger field only — **not** title matching.

**STOP condition:** Not triggered — reliable domain field exists (`autoCompleteTrigger`).

### 0.4 `payment_received` / `triggerAutoComplete` — global vs scoped?

**Global per event** (app + same semantic elsewhere):

```text
markLineItemPaid / Stripe webhook
  → triggerAutoComplete(..., "payment_received", "payment_line_item", itemId)
  → repo.autoCompleteTrigger: all open event_tasks on that event where auto_complete_trigger = 'payment_received'
```

Does **not** distinguish deposit vs installment vs final balance. Coordinator “Verify deposit” also uses `payment_received` (coordinator_only — not in couple portal). Luv `final_payment_received` already uses payment readiness `complete` — separate path.

### 0.5 Other legitimate payment checklist tasks when a payment line exists

| Task | Portal visible? | With unpaid lines? |
| --- | --- | --- |
| Client Planning “Final payment” (`payment_received`) | Yes | **Suppressed** from attention (this WP) |
| Coordinator “Verify deposit” (`payment_received`) | No (`coordinator_only`) | N/A |
| Custom couple checklist with `payment_received` (any title) | Possible | **Suppressed** when unpaid lines exist (trigger gate) |
| Checklist titled like payment but **no** `payment_received` | Possible | **Kept** (case 6 / no title dedupe) |
| Non-payment domain tasks (guest count, timeline, insurance, …) | Yes | **Kept** |

---

## 1. Behavior shipped (5 WP cases)

| # | Case | Result |
| --- | --- | --- |
| 1 | Unpaid line + `payment_received` mirror | Pay now (ledger) only; mirror omitted from attention; **DB row stays** |
| 2 | Paid | Ledger attention gone; open mirror may reappear only if still incomplete and no unpaid lines; auto-complete path unchanged |
| 3 | Checklist, no payment line | Checklist stays visible (Impl 1 Pay now → `#payments`, `canComplete=false`) |
| 4 | Payment line, no checklist | Pay now only; no synthetic checklist |
| 5 | Multiple installments | Distinct Pay now rows; canonical schedules; no title collapse |

Same `buildUnifiedTaskList` feeds Home Next Steps + Tasks + attention counts.

---

## 2. `payment_received` trigger safety — LIMITATION (no invent)

**Not narrowed in this WP.**

| Question | Finding |
| --- | --- |
| Can we safely scope so Final payment does not complete on any payment? | **Not with current schema** — no line↔task FK; trigger is event-global “any payment received” |
| Safe attention fix without broadening? | **Yes** — suppress mirrors when unpaid lines exist (done) |
| Follow-on (Impl 3 / later) | New final-aware trigger or readiness-aligned complete; split deposit verification — **out of scope** |

Payment remains couple completion mechanism for money (Pay now). Checklist `canComplete` stays false (Impl 1).

---

## 3. Code changes

| File | Change |
| --- | --- |
| `lib/portal/unified-tasks.ts` | Canonicalize schedules first; collect unpaid lines; omit incomplete `payment_received` venue_task mirrors when unpaid exists; `isPaymentReceivedMirror` helper |
| `lib/portal/unified-tasks.test.ts` | Cases 1–8 |
| `docs/qa/couple-task-payment-attention-implementation-2.md` | This report |
| `docs/qa/couple-task-payment-attention-impl2/*` | Live QA screenshots + `qa-results.json` + capture script |

**Unchanged:** payment schema / schedule / processing / UI; Home Review (`5657066`); Impl 1 policy; no deletes of `event_tasks` or `payment_line_items`; WW / Studio / vendor architecture / celebrations / insurance / Impl 3.

---

## 4. Tests

`npx tsx --test lib/portal/unified-tasks.test.ts lib/portal/next-steps.test.ts` — **31/31 pass**.

| Case | Asserts |
| --- | --- |
| 1 | Unpaid + mirror → mirror hidden; Pay now present; Home≡Tasks ids |
| 2 | Paid → no payment kind; mirror not inventing twin Pay now ledger row |
| 3 | No schedules → mirror visible |
| 4 | Line only → Pay now; no venue_task invented |
| 5 | Multi-installment + dup schedules → 3 distinct payments; mirror hidden; remaining balance |
| 6 | Title “Final payment” **without** trigger → **not** hidden |
| 7 | Guest count / insurance remain beside unpaid lines |
| 8 | Different title + `payment_received` suppressed; presentation still blocks Mark complete |

---

## 5. Live QA — Emma & Jordan seed

**Env:** `http://localhost:3000` · token `seedcoupleportal00000000000000000000000000000001`  
**Artifacts:** `docs/qa/couple-task-payment-attention-impl2/`  
**No mark-paid** on live ledger.

### Counts before → after

| Metric | Before (Impl 1 `qa-results.json`) | After |
| --- | --- | --- |
| Home “N left” / hero waiting | **9** | **8** |
| Home Next Steps includes checklist “Final payment” | **Yes** (Pay) | **No** |
| Tasks open Pay now count | **4** (3 installments + checklist twin) | **3** (installments only) |
| Tasks open checklist “Final payment” | **Yes** | **No** |
| Tasks open ledger “Final Payment” | **Yes** | **Yes** (Pay now) |
| Tasks badge (completable venue/vendor) | 2 | **2** (unchanged) |
| Venue checklist progress strip | 6/10 | **6/10** (DB row remains incomplete) |
| Payments remaining | $12,960 | **$12,960** |
| Payments schedule 3 lines + Pay now | Yes | **Yes** |
| Home Complete CTAs | 0 | **0** (`5657066` intact) |

### Desktop + mobile matrix

| Check | Desktop | Mobile |
| --- | --- | --- |
| Only ledger Final Payment Pay now on Tasks | Pass | Pass |
| Twin not consuming Next Steps | Pass | Pass |
| Shared planning shows payment (First Installment Pay) | Pass | Pass |
| Payments totals/schedule/Pay now unchanged | Pass | Pass |
| No Home “Complete” | Pass | Pass |

API proof DB intact: `GET /api/portal/tasks` still returns pending **Final payment** `d315e9d6-…` with `autoCompleteTrigger: payment_received`, `canComplete: false`.

---

## 6. Explicit confirmations

- [x] Did not revert `5657066` Home Review CTA  
- [x] Did not weaken Impl 1 verified-action (`canComplete=false`, destinations)  
- [x] Did not change `c60be1c` canonicalization semantics (still used)  
- [x] Did not change payment Pay Now / processing / schema / schedule schema / UI architecture  
- [x] Did not delete `event_tasks` or `payment_line_items`  
- [x] Did not title-dedupe / fuzzy hide all “payment” tasks  
- [x] Did not narrow `payment_received` auto-complete (limitation §2)  
- [x] Did not touch WW / Studio / Collections / Photo Styles / Hosted / Home hierarchy / vendor redesign / celebrations / insurance / deep-links / Share timeline / Impl 3  
- [x] No push to remote  

---

## 7. Commit

```
Couple Tasks – Implementation 2 – Payment Attention and Final Payment Twin
```

Hash recorded after commit in parent report.
