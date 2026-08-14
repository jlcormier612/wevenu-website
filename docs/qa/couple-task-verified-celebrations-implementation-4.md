# Couple Tasks — Verified Domain Completion Celebrations · Implementation 4

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Source of truth:** `docs/qa/couple-task-verified-action-completion-investigation.md` §9 / sequence step 6; Impl 1–3  
**Rule:** ONLY CELEBRATE WHAT THE SYSTEM CAN PROVE.

**Must remain intact (local, not pushed):**  
- `5657066` Home Review CTA  
- `0ad64af` Verified Action Completion Impl 1  
- `fc843dc` Payment Attention Impl 2  
- `358153b` Workspace Deep Links  

---

## 1. Architecture confirmation (inspect-first)

| Question | Finding |
| --- | --- |
| Where verified completion is produced | Domain RPCs / services: `submit_guest_count`, `submit_vendor_list`, `submit_seating_plan`, `submit_timeline`, `sign_contract`, `submit_questionnaire_as_couple` (+ app `triggerAutoComplete` for contract / venue questionnaire / payments). |
| Where task → completed | SQL auto-complete loops inside those RPCs, or `triggerAutoComplete` → `completeEventTask(..., "system")`. |
| Durable one-time celebration record | `luv_celebrations` unique `(client_id, celebration_type)`; insert `on conflict do nothing` → `celebrated`. |
| Can `luv_celebrations` represent these milestones without changing meaning? | **Yes** — same Commitment Lifecycle one-shot class as guest/timeline/contract. Extending CHECK only; not a new product meaning for Luv suggestions. |
| Is task confetti manual-only? | **Yes** — `celebrateTaskComplete` only after Mark complete / vendor complete success. Domain auto-complete never called it. Seating had an always-on 🎉 toast (fixed). |

Celebration is **layered acknowledgment** — it does **not** own task completion.

---

## 2. Schema decision

- **Did not** create a new celebration table.
- **Did** extend `luv_celebrations.celebration_type` CHECK to add:
  - `vendor_list_submitted`
  - `seating_submitted`
  - `questionnaire_submitted`
- STOP for “new table required” **not** triggered.

---

## 3. Eligible verified celebrations (shipped)

| Domain event | Celebration type | New? | UI |
| --- | --- | --- | --- |
| Guest count submit | `guest_list_submitted` | No | Existing Finalize card |
| Timeline submit | `timeline_submitted` | No | Existing timeline |
| Contract sign | `contract_signed` | No | Existing sign form |
| Vendor list submit | `vendor_list_submitted` | **Yes** | `vendor-section` iff `celebrated` |
| Seating submit | `seating_submitted` | **Yes** | `seating-section` iff `celebrated` |
| Questionnaire submit (couple) | `questionnaire_submitted` | **Yes** | `CoupleQuestionnaireForm` iff `celebrated` |

---

## 4. Payment decision

| Candidate | Safe? | Action |
| --- | --- | --- |
| `payment_received` (any paid line) | **No** — over-broad; cannot scope without title/amount/due inference | **Left unchanged — no new celebration** |
| Existing `final_payment_received` (readiness complete) | Already proven | **Unchanged** |

---

## 5. Must NOT celebrate (confirmed)

| Item | Why |
| --- | --- |
| Insurance | Couple path incomplete (Impl 1 STOP); no invent |
| Share timeline | Manual ack; no typed domain signal |
| Leave review / package / null-trigger Mark complete | Acknowledgment-only → optional `celebrateTaskComplete` only, **not** verified Luv |
| Navigate / draft / open form / refetch | No insert → no celebration |
| Already-complete row on reload | Conflict → `celebrated: false` |

---

## 6. One-time / idempotency model

1. Domain RPC inserts into `luv_celebrations` in the same transaction.
2. Returns `{ celebrated: true }` only when insert wins.
3. UI calls `celebrateLuv` **only** when `celebrated === true`.
4. Never: `useEffect(() => { if (task.completed) confetti() })` without durable consume.

---

## 7. Double-fire prevention

- Impl 1 blocks Mark complete when trigger set → domain tasks cannot fire `celebrateTaskComplete`.
- Domain celebrations use Luv path only.
- Seating always-🎉 toast removed; gated on `celebrated`.
- Helpers: `shouldPresentVerifiedCelebration`, `mayCelebrateManualTaskComplete`.

---

## 8. Copy

Warm hospitality (Luv voice), brief:

- “Your vendor list is with your venue. 🎉”
- “Your seating plan is submitted. 🎉”
- “Your final details are in. 🎉”

No productivity/gamification. Existing `celebrateLuv` visual (no redesign).

---

## 9. Exact files changed

| File | Change |
| --- | --- |
| `supabase/migrations/20261234000000_verified_domain_completion_celebrations.sql` | CHECK widen + vendor/seating/questionnaire inserts |
| `lib/luv/celebrations.ts` | Types + copy |
| `lib/luv/celebrations.test.ts` | Copy tests |
| `lib/luv/verified-domain-celebrations.ts` | Eligibility map + gates |
| `lib/luv/verified-domain-celebrations.test.ts` | Eligibility / deny / one-time / double-fire |
| `components/portal/vendor-section.tsx` | Celebrated-gated presentation |
| `components/portal/seating-section.tsx` | Celebrated-gated; remove always-🎉 |
| `components/form/couple-questionnaire-form.tsx` | Celebrated-gated |
| `app/api/public/questionnaire/route.ts` | Pass `celebrated` |
| `docs/qa/couple-task-verified-celebrations-implementation-4.md` | This report |
| `docs/qa/couple-task-verified-celebrations/*` | Live QA |

---

## 10. Tests

```bash
npx tsx --test \
  lib/luv/celebrations.test.ts \
  lib/luv/verified-domain-celebrations.test.ts \
  lib/portal/unified-tasks.test.ts \
  lib/portal/next-steps.test.ts \
  lib/portal/workspace-routing.test.ts
```

**Result:** **82/82 pass**.

---

## 11. Live QA (Emma & Jordan)

**Env:** `http://localhost:3000` · seed portal token  
**Migration applied locally.** Floor plan temporarily `view` for seating probe; **restored `hidden`**.

| Probe | First `celebrated` | Second | Pass |
| --- | --- | --- | --- |
| Guest count | true | false | ✓ |
| Seating submit | true | false | ✓ |
| Vendor submit | true | false | ✓ |
| Questionnaire | true | false | ✓ |

Also: no payment_received/insurance celebration rows; Tasks/Home load no confetti; desktop + mobile screenshots.

Artifacts: `docs/qa/couple-task-verified-celebrations/` (`qa-results.json`, `capture.mjs`, `01-desktop-*`, `02-mobile-*`).

---

## 12. Regression / untouched surfaces

Unchanged: Home hierarchy, Home Review CTA (`5657066`), Tasks routing/CTA/destinations (Impl 1/3), payment attention (Impl 2), completion rules (Impl 1), Luv suggestions-first meaning, WW/Studio/Collections/Photo Styles/Hosted/RSVP, payments schema/processing, vendor/legal/onboarding/RW/marketing/publishing.

---

## 13. STOP conditions evaluation

| Condition | Triggered? |
| --- | --- |
| Can't ID relationship | No |
| Trigger too broad (payment) | Payment left unchanged |
| Completion without domain event | Not celebrated |
| Multi-accomplish ambiguity | Unique `(client_id, celebration_type)` |
| New table required | No |
| Payment unsafe | Left unchanged |
| Insurance invent | Not celebrated |
| Double-fire | Prevented |
| Title matching | Not used |
| WW/Studio / inventing signals | Untouched |

---

## 14. Explicit confirmations

- [x] Did not revert prior Impl commits listed above  
- [x] Celebration does not own task completion  
- [x] Prefer `luv_celebrations` (extended types; no new table)  
- [x] Payment celebration unchanged (unsafe to scope `payment_received`)  
- [x] No confetti redesign; no verified celebration for Mark complete ack  
- [x] No push to remote  

---

## 15. Risks / follow-ons (out of scope)

- Couple insurance still cannot prove domain completion → still no celebration.  
- Share timeline still acknowledgment-only.  
- Narrowing `payment_received` / final-aware trigger remains a separate WP.  
- Seed Emma now has first-fire rows for the four celebration types exercised in QA (expected).

---

## 16. Product separation reminder

| Layer | This WP |
| --- | --- |
| TASK | Unchanged |
| CTA | Unchanged |
| DOMAIN ACTION | Unchanged commit semantics |
| COMPLETION SIGNAL | Unchanged (Impl 1) |
| CELEBRATION | One-time Luv fire on newly proven submit |

---

## 17. Commit

```
Couple Tasks – Implementation 4 – Verified Domain Completion Celebrations
```
