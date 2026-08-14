# Couple Tasks — Exact Workspace Routing · Implementation 3

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Source of truth:** `docs/qa/couple-task-verified-action-completion-investigation.md` §8; Impl 1 + Impl 2  
**Related shipped (must remain intact):**  
- `5657066` Home Review CTA  
- `0ad64af` Verified Action Completion Impl 1 (`canComplete=false`, destinations, questionnaire wiring)  
- `fc843dc` Payment Attention Impl 2  

---

## 0. Inspection before coding (reuse first)

| Surface | Existing mechanism | Within-section focus? |
| --- | --- | --- |
| Portal shell | `#section` → `activeSection` on mount | **No** (section only) |
| Tasks / Home CTAs | `onNavigate(targetSection)` | Landing on section top |
| Guests | `FinalizeGuestCountCard` near top of Guests | No scroll target id |
| Vendors | Pick/submit workflow is the section body | No focus id |
| Seating | Commit/submit bar already at top | No focus id |
| Timeline | `TimelineStatus` submit card at top | No focus id |
| Documents | Contracts + pending-signature banner | No focus id |
| Questionnaire | Whole section is the form | No focus id |
| Payments | Section `#payments` (Impl 1/2) | Left unchanged |

**Decision:** Extend existing hash convention to `#section/focus`, add stable focus element ids, scroll on navigate. No new pages, no duplicate domain UIs, no title routing.

**STOP:** Not triggered — every scoped target has a reliable mapping via `autoCompleteTrigger` / derived `kind` and a real action control to anchor.

---

## 1. Exact files changed

| File | Change |
| --- | --- |
| `lib/portal/workspace-routing.ts` | **New** — hash parse/format, focus ids, scroll helper |
| `lib/portal/workspace-routing.test.ts` | **New** — hash + completion-safety routing tests |
| `lib/portal/unified-tasks.ts` | `targetFocus` on presentation + unified rows; trigger→focus map |
| `lib/portal/unified-tasks.test.ts` | Focus assertions; title-not-routing; payment focus null |
| `lib/portal/next-steps.ts` | Pass `targetFocus` through Home items |
| `lib/portal/next-steps.test.ts` | Fixture + fromUnified mapping |
| `components/portal/portal-shell.tsx` | `navigateTo(section, focus?)`, hashchange, scroll-to-focus |
| `components/portal/unified-tasks-section.tsx` | CTA navigates with `targetFocus` |
| `components/portal/finalize-guest-count-card.tsx` | `id="portal-focus-guests-finalize"` |
| `components/portal/vendor-section.tsx` | `id="portal-focus-vendors-pick"` |
| `components/portal/seating-section.tsx` | `id="portal-focus-seating-submit"` |
| `components/portal/timeline-section.tsx` | `id="portal-focus-timeline-submit"` |
| `components/portal/couple-documents-section.tsx` | `id="portal-focus-documents-sign"` |
| `components/portal/questionnaire-section.tsx` | `id="portal-focus-questionnaire-form"` |
| `docs/qa/couple-task-workspace-routing-implementation-3.md` | This report |
| `docs/qa/couple-task-workspace-routing-impl3/*` | Live QA artifacts |

---

## 2. Routing map before → after

| Task (structured key) | Before (Impl 1) | After (Impl 3) |
| --- | --- | --- |
| `guest_count_finalized` | `#guests` | `#guests/finalize` → Guest Count finalize card |
| `vendor_selected` | `#vendors` | `#vendors/pick` → vendor picker / submit workflow |
| `seating_submitted` | `#seating` | `#seating/submit` → seating submit bar |
| `timeline_submitted` | `#timeline` | `#timeline/submit` → Timeline Status submit |
| `contract_signed` (+ derived contract) | `#documents` | `#documents/sign` → signature / contracts band |
| `questionnaire_submitted` (+ derived) | `#questionnaire` | `#questionnaire/form` → form root |
| `payment_received` / payment lines | `#payments` | **Unchanged** (`targetFocus: null`) |
| `document_uploaded_insurance` | `#documents` | **Unchanged** (no invent; limitation) |
| Null-trigger acknowledgment | `#tasks` + Mark complete | **Unchanged** |

Routing keys: `autoCompleteTrigger` for venue_task; `kind` for derived contract / questionnaire / timeline. **Never titles.**

---

## 3. How each of the six domain tasks deep-links

| Domain | Tasks CTA | Hash | DOM focus id | Domain completion SoT |
| --- | --- | --- | --- | --- |
| Guest count | Submit guest count | `#guests/finalize` | `portal-focus-guests-finalize` | `guest_count_finalized` / `submit_guest_count` |
| Vendors | Add vendors | `#vendors/pick` | `portal-focus-vendors-pick` | `vendor_selected` / `submit_vendor_list` |
| Seating | Submit seating | `#seating/submit` | `portal-focus-seating-submit` | `seating_submitted` |
| Timeline | Submit timeline | `#timeline/submit` | `portal-focus-timeline-submit` | `timeline_submitted` |
| Contract | Review & sign | `#documents/sign` | `portal-focus-documents-sign` | `contract_signed` |
| Questionnaire | Complete form | `#questionnaire/form` | `portal-focus-questionnaire-form` | `questionnaire_submitted` (wired Impl 1) |

Home uses the same `targetSection` + `targetFocus` under compact labels from `5657066` (Submit / Pay / Review — navigate only).

---

## 4. Navigation never completes a task

- Tasks CTA when `completableHere === false` only calls `navigateTo` (hash + section + scroll).
- Home Next Steps only calls `navigateTo`.
- Scroll / focus / `data-portal-focused` are presentation-only.
- Opening Guests / typing / selecting vendors does not call complete APIs.

---

## 5. Domain triggers remain completion SoT

- No changes to submit RPCs, `triggerAutoComplete`, payment mark-paid, contract sign, or questionnaire couple wiring.
- `canComplete=false` + `complete_portal_task` rejection for triggered rows preserved from Impl 1.

---

## 6. Tests and results

`npx tsx --test lib/portal/unified-tasks.test.ts lib/portal/next-steps.test.ts lib/portal/workspace-routing.test.ts` — **40/40 pass**.

Covered:
1. Domain tasks resolve to intended workspace + focus  
2. Deterministic structured metadata (trigger/kind; weird titles ignored)  
3. Navigate presentation ⇒ `completableHere: false`  
4. Auto-complete remains authoritative (no new complete path)  
5. Manual blocked when trigger set  
6. Payment Impl 2 twins / Pay now / `targetFocus: null` unchanged  
7. Home compact Mark complete → Review intact  
8. Null-trigger still Mark complete  

---

## 7. Desktop / mobile QA results

**Env:** `http://localhost:3000` · Emma & Jordan seed token `seedcoupleportal00000000000000000000000000000001`  
**Artifacts:** `docs/qa/couple-task-workspace-routing-impl3/` (`qa-results.json`, screenshots)

### Seed open-attention note
Emma & Jordan open Tasks (at capture) included **Submit guest count**, **Submit timeline**, payment Pay now rows, Leave a review — not open vendors / seating / contract / questionnaire checklist rows (already complete, not released, or absent). Routing for those four was verified via **direct hash** deep-links (same `targetFocus` metadata used by CTAs when open).

### Results

| Check | Desktop | Mobile |
| --- | --- | --- |
| Guest count CTA → `#guests/finalize` + focus id | Pass | Pass |
| Timeline CTA → `#timeline/submit` + focus id | Pass | Pass |
| Hash `#vendors/pick` / `#seating/submit` / `#questionnaire/form` + focus | Pass | Pass |
| Hash `#documents/sign` lands Documents (focus id on section root) | Pass* | Pass* |
| Guest / timeline still `pending`, `canComplete: false` after nav | Pass | Pass |
| `POST complete-task` guest count → `422 domain_verified_use_workspace` | Pass | — |
| Home Complete CTAs = 0 | Pass | Pass |
| Payment twin suppressed; Payments `$12,960` + 3 Pay now | Pass | Pass |
| Tasks Mark complete count = 1 (Leave a review only) | Pass | Pass |

\*Initial capture found Documents marker with missing focus id when no pending contract row existed; focus id moved to Documents section root so empty/signed states still resolve.

Domain submit → auto-complete not re-executed for every obligation (protects seed ledger/submissions). Triggers remain Impl 1 SQL/app SoT; navigation incompleteness + blocked manual complete verified live.


---

## 8. Blocked / unsupported deep links

| Item | Status |
| --- | --- |
| Insurance exact upload control | **Out of scope** — no couple insurance category; left `#documents` only |
| Payment within-line focus | Unchanged / not required this WP |
| Vendor “Share timeline” typed domain | Still acknowledgment `#tasks` (no title routing) |

---

## 9. Insurance intentionally unchanged

Left as Impl 1: CTA Upload insurance → `#documents`, manual blocked, couple upload does **not** fire `document_uploaded_insurance`. No invented category, filename match, or new data model.

---

## 10. Payment work from `fc843dc` intact

- Unpaid lines → Pay now; `payment_received` mirrors suppressed when unpaid lines exist  
- No payment schema / trigger narrowing / title dedupe  
- Payment unified rows: `targetFocus: null`

---

## 11. Home Review (`5657066`) intact

- Compact helper unchanged  
- Home does not complete  
- Review / Submit / Pay still navigate-only; now carry `targetFocus` when structured metadata provides it  

---

## 12. Wedding Website / Studio untouched

No edits under wedding-website / Studio / Collections / Photo Styles / Hosted / RSVP / publishing.

---

## 13. Commit hash

See git after commit:

```
Couple Tasks – Implementation 3 – Exact Workspace Routing
```

---

## 14. DO NOT PUSH

Confirmed — commit local only; no `git push`.

---

## Explicit confirmations

- [x] Did not revert `5657066` / `0ad64af` / `fc843dc`  
- [x] No celebrations / confetti / `luv_celebrations` changes  
- [x] No generic completion framework  
- [x] No title-based routing  
- [x] No new pages / duplicate domain workflows  
- [x] Deep link ≠ completion  
