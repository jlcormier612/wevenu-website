# Couple Tasks — Verified Action Completion · Implementation 1

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Source of truth:** `docs/qa/couple-task-verified-action-completion-investigation.md`  
**Related:** `docs/qa/couple-home-polish-investigation.md`  
**Do not revert:** `5657066` Home Review CTA remapping (left intact)

---

## 1. Architecture confirmation

Investigation architecture **matches** live code. No STOP on discrepancy.

| Layer | Confirmed |
| --- | --- |
| Stores | `event_tasks` + `vendor_tasks` (couple visibility) |
| Auto-complete app | `triggerAutoComplete` → `repo.autoCompleteTrigger` |
| Auto-complete SQL | guest count / seating / vendors / timeline submit RPCs |
| Unified Tasks | `buildUnifiedTaskList` synthesizes venue + derived kinds |
| Home | navigate-only; `compactNextStepsActionLabel` → Review for checklist |

---

## 2. Inventory map (pre-implementation → post)

| Task | Source | autoCompleteTrigger | Pre CTA | Target (post) | Domain destination | Domain completion signal | Manual path | Signal works? | Exact file / function |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest count | `event_tasks` Client Planning | `guest_count_finalized` | Mark complete → `#tasks` | Submit guest count → `#guests` | Guests / FinalizeGuestCountCard | `submit_guest_count` SQL loop | Blocked | **Yes** | `supabase/...guest_count_submission.sql`; presentation `venueTaskPresentation` |
| Vendors | same | `vendor_selected` | Mark complete | Add vendors → `#vendors` | Vendors submit list | `submit_vendor_list` SQL | Blocked | **Yes** | vendor selection RPC + `venueTaskPresentation` |
| Seating | same | `seating_submitted` | Mark complete | Submit seating → `#seating` | Seating studio submit | `submit_seating_plan` SQL | Blocked | **Yes** | seating RPC + presentation |
| Timeline | same | `timeline_submitted` | Mark complete | Submit timeline → `#timeline` | Timeline Submit | `submit_timeline` SQL + Luv | Blocked | **Yes** | timeline RPC + presentation |
| Contract | same | `contract_signed` | Mark complete (+ derived Sign) | Review & sign → `#documents` | `/sign/{token}` | `lib/contracts/service.ts` → `triggerAutoComplete` | Blocked | **Yes** | contracts service + presentation |
| Payment (checklist) | same | `payment_received` | Mark complete (**twin**) | Pay now → `#payments` | Payments checkout | `markLineItemPaid` / Stripe → `payment_received` (**over-broad**) | Blocked | Money yes; task matching **unsafe** — see §7 | payments service / webhook; **no twin suppress** this impl |
| Questionnaire | same | `questionnaire_submitted` | Mark complete | Complete form → `#questionnaire` | Public questionnaire form | **Wired** in `submit_questionnaire_as_couple` (+ venue path unchanged) | Blocked | **Yes** (couple path now) | migration `20261231000000_...` |
| Insurance | same | `document_uploaded_insurance` | Mark complete | Upload insurance → `#documents` | Documents upload | Venue `saveDocument` category insurance only | Blocked | **Couple path NO** — see §6 | `lib/documents/service.ts` venue only |
| Vendor Share Timeline | `vendor_tasks` owned | none | checkbox Mark complete | stays `#tasks` + manual | Notes only (no typed share action) | none | **Kept** (acknowledgment-only) | **No domain** — see §6 | `complete_portal_vendor_task`; demo notes SQL only |
| Leave a review / Choose package | `event_tasks` | `null` | Mark complete | Mark complete → `#tasks` | none today | none | **Kept** | N/A | acknowledgment / missing domain |

**Deep-link limitation:** Section-level `#guests` / `#vendors` / etc. only. No within-section focus (e.g. scroll to Finalize Guest Count). Existing destinations only; no new deep-link infra.

---

## 3. What shipped

### Policy
- `get_portal_tasks`: returns `autoCompleteTrigger`; `canComplete=false` when trigger set.
- `complete_portal_task`: rejects with `domain_verified_use_workspace` when trigger set.
- `resolvePortalTasks`: maps trigger; defense-in-depth forces `canComplete=false` if trigger present.
- Venue/coordinator complete paths **unchanged**.

### CTA / destination
- `venueTaskPresentation` + `buildUnifiedTaskList` map trigger → workspace CTA (Submit guest count, Add vendors, Submit seating, Submit timeline, Review & sign, Pay now, Complete form, Upload insurance).
- Non-triggered `client_owned` tasks keep **Mark complete**.
- Derived payment / contract / request / questionnaire / timeline rows unchanged (navigate-only).

### Questionnaire wiring
- `submit_questionnaire_as_couple` now auto-completes `questionnaire_submitted` playbook tasks (SQL loop, idempotent), matching guest-count pattern. Venue `saveQuestionnaireAction` path unchanged.

### Home / Issue 1
- `5657066` Review compact helper **left intact**.
- Not expanded Incomplete→Review as product direction.

### Files touched
| File | Change |
| --- | --- |
| `supabase/migrations/20261231000000_portal_verified_task_completion.sql` | portal tasks policy + questionnaire auto-complete |
| `lib/portal/types.ts` | `autoCompleteTrigger` on `PortalTask` |
| `lib/portal/service.ts` | normalize tasks + policy |
| `lib/portal/unified-tasks.ts` | presentation / destinations |
| `lib/portal/next-steps.ts` | `UnifiedTaskTargetSection` type align |
| `lib/portal/unified-tasks.test.ts` | policy + regression tests |
| `lib/portal/next-steps.test.ts` | fixture field |
| `docs/qa/couple-task-verified-action-completion-implementation-1.md` | this report |
| `docs/qa/couple-task-verified-action-completion/*` | QA screenshots + `qa-results.json` |

---

## 4. Manual completion policy (classification)

| Class | Couples Mark complete? | Examples |
| --- | --- | --- |
| Domain-verifiable (trigger set) | **No** | guest count, vendors, seating, timeline, contract, payment checklist, questionnaire, insurance (trigger present) |
| Domain-verifiable-missing signal | Trigger still blocks manual; domain couple path incomplete | **Insurance** couple upload (see §6) |
| Acknowledgment-only | **Yes** | Leave a review; Choose your package (no couple package SoT); owned vendor tasks without typed action (**Share timeline**) |
| Unclear | not removed | Custom venue tasks with unused/unknown triggers → **View** + blocked manual (escape: venue complete/waive) |

---

## 5. Celebration

- No celebration redesign; no new table.
- Manual Mark complete still uses `celebrateTaskComplete` (only when couple presses it).
- Domain auto-complete (SQL / `triggerAutoComplete`) does **not** fire task confetti — correct (couple did not press Mark complete).
- Existing Luv one-shots (`guest_list_submitted`, `timeline_submitted`, `contract_signed`, etc.) unchanged.
- **Limitation:** Confetti is not applied to domain auto-complete rows; silent list update / existing Luv milestones only.

---

## 6. STOP / deferred — Insurance & Vendor Share Timeline

### Insurance (`document_uploaded_insurance`)
- **Enough info to wire couple path?** **No.**
- `couple_documents` has no insurance category/doc type; portal upload posts generic `sourceType: "upload"` + optional `shareWithVenue` only (`components/portal/couple-documents-section.tsx`, `app/api/portal/documents/route.ts`).
- Venue `saveDocument` with `category==='insurance'` remains the only trigger fire path.
- Impl still blocks Mark complete (trigger exists) and CTAs to `#documents` / Upload insurance.
- **Escape hatch:** venue coordinator complete/waive (unchanged).
- **Safest future:** couple upload UI + persisted insurance category (or event `documents` row with category insurance when shared) → then `triggerAutoComplete(..., document_uploaded_insurance)`. No title-matching.

### Vendor Share Timeline
- No typed domain action / auto-complete on `vendor_tasks`.
- Demo notes hygiene only (`scripts/local-qa/fix-share-timeline-demo-notes.sql`).
- Timeline guest audience ≠ vendor_task completion.
- **Classification:** acknowledgment-only → **keep Mark complete**.
- **Safest future:** optional typed `actionType` / share metadata on vendor tasks — **no new DB model in this WP**; report first if urgently required.

---

## 7. Payment twin / `payment_received` (REPORT ONLY — not fixed)

Per hard rule: **no** title-dedupe / delete / suppress / schema change / mark-paid in QA.

| Observation (Emma & Jordan seed) | Detail |
| --- | --- |
| Twin rows | Checklist **Final payment** (now CTA **Pay now** → `#payments`) + derived **Final Payment** (**Pay now**) |
| Relationship | Same real-world final obligation conceptually; different IDs (`event_tasks` vs `payment_line_items`) |
| Manual Mark complete | **Disabled** on checklist (trigger set) — trust hazard reduced |
| Trigger over-broad? | **Yes.** Any paid line item fires `payment_received`, which can complete Final payment / Verify deposit early. Unsafe to “fix” without redesign (final-aware trigger or readiness-aligned complete). |
| Recommended follow-on | Attention suppress of `payment_received` mirrors when unpaid lines exist; then narrow trigger for final vs deposit — separate WP |

---

## 8. Tests

`npx tsx --test lib/portal/unified-tasks.test.ts lib/portal/next-steps.test.ts` — **23/23 pass**.

Policy coverage:
- Triggered → no Mark complete; correct section/label  
- Navigate presentation ≠ completableHere  
- Domain mapping for all catalog triggers  
- Non-triggered keeps Mark complete  
- Already-complete → Done  
- Unknown trigger → View + blocked  
- Regression: derived payment/contract navigate-only; Home compact Mark complete → **Review**; Submit guest count → **Submit**; Pay now → **Pay**

---

## 9. QA matrix (Emma & Jordan seed)

**Environment:** `http://localhost:3000` · token `seedcoupleportal00000000000000000000000000000001`  
**Migration applied locally** for live RPC verification.  
**No mark-paid** on live ledger.

| Check | Desktop | Mobile | Result |
| --- | --- | --- | --- |
| Guest count CTA | Submit guest count | same | Pass |
| Timeline CTA | Submit timeline | same | Pass |
| Final payment checklist CTA | Pay now (not Mark complete) | same | Pass |
| Leave a review | Mark complete once | same | Pass |
| Share timeline | checkbox / owned complete | same | Pass (manual kept) |
| Inappropriate Mark complete on triggered | absent | absent | Pass (`mark` count = 1 = leave review) |
| Home guest count / timeline | Submit | Submit | Pass |
| Home Final payment | Pay | Pay | Pass |
| Home Share timeline / Leave review | Review | Review | Pass (`5657066` intact) |
| Home no Complete | 0 Complete buttons | 0 | Pass |
| `complete-task` on guest count | `domain_verified_use_workspace` | — | Pass; status remains pending |
| Payment twin still visible | yes (expected) | yes | Reported §7 |

Artifacts: `docs/qa/couple-task-verified-action-completion/` (`01-desktop-*`, `02-mobile-*`, `qa-results.json`).

---

## 10. Explicit confirmations

- [x] Did **not** revert `5657066` Home Review CTA  
- [x] Did **not** expand Incomplete→Review as product direction  
- [x] Did **not** touch Wedding Website / Studio / Collection / Photo Style / Hosted Experience / public WW / publishing / RSVP  
- [x] Did **not** change payment schema / schedule architecture  
- [x] Did **not** redesign vendor architecture  
- [x] Did **not** redesign Tasks page product / invent new pages / workflows  
- [x] Did **not** invent generic completion architecture or celebration table  
- [x] Did **not** implement Final payment twin cleanup (Issue 2)  
- [x] Did **not** mark paid in live QA  
- [x] No push to remote  

---

## 11. Commit

See git history after commit:

```
Couple Tasks – Verified Action Completion Implementation 1
```
