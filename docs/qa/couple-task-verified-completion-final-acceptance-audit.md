# Couple Tasks — Final Verified Completion Acceptance Audit

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Mode:** STRICT READ-ONLY — no code, DB, migration, seed, or product changes  
**Explicit:** **No changes made** in this audit.

**Source of truth (local, not pushed):**

| Commit | Work |
| --- | --- |
| `5657066` | Home Review CTA (Next Steps compact labels) |
| `0ad64af` | Verified Action Completion Impl 1 |
| `fc843dc` | Payment Attention / Final Payment Twin Impl 2 |
| `358153b` | Exact Workspace Routing Impl 3 |
| `56e98a4` | Verified Domain Completion Celebrations Impl 4 |

**Prior docs reviewed:** `docs/qa/couple-task-verified-action-completion-investigation.md`, Impl 1–4 reports, related `qa-results.json` artifacts.

**Product rule under audit:**  
`TASK → CTA → domain action → verification → auto complete → one-time Luv celebration (only when newly completed)`.  
Never complete on navigate / open / type / draft / Mark Complete (for verified) / refetch.

---

## Verdict

**PASS** for the shipped verified-completion model across Impl 1–4 + Home Review CTA, with **three intentional gaps confirmed** (Insurance couple path, Share Timeline acknowledgment-only, Payment/`payment_received` not celebrated / trigger not narrowed).

No FAIL items that contradict the product rule for shippable verified domains. Remaining gaps match documented STOP conditions; do not treat them as regression defects of Impl 1–4.

---

## Audit method & limitations

| Activity | Result |
| --- | --- |
| Code review | `unified-tasks`, `workspace-routing`, `next-steps`, portal service policy, celebration helpers, portal UI gate sites, migrations `20261231000000_*` / `20261234000000_*` |
| Unit tests (this pass) | **61/61 pass** (see § Tests) |
| Live GET APIs (Emma & Jordan seed token) | `/api/portal/tasks`, `payments`, `questionnaire`, `timeline`, `documents`, `requests` — **read-only** |
| Live attention synthesis | Recomputed via `buildUnifiedTaskList` / Next Steps helpers from GET payloads — **no writes** |
| Browser UI | Browser MCP could not retain a tab this pass — UI conclusions use GET/synthesis + prior Impl 1–4 screenshots/`qa-results.json` |
| Mutations | **Zero.** Did **not** POST submit / pay / Mark complete / complete-task. Domain reject (`domain_verified_use_workspace`) and first-fire celebration proofs cited from Impl 1 / Impl 4 prior QA only |

**Seed state note:** Prior Impl 4 live probes mutated Emma & Jordan (guest/vendor/seating/questionnaire celebration fires + related completes; timeline also complete). This audit observes **post-Impl-4** seed and still validates policy rows for completed domain tasks + remaining open attention.

---

## Per-task WP checklist (Q1–Q15)

Applied to every couple-visible Home/Tasks attention case (open now or catalog attention cases named in the WP):

| # | Question |
| --- | --- |
| Q1 | Task identity / title |
| Q2 | Source (`event_tasks` / derived / `vendor_tasks`) |
| Q3 | Tasks CTA label |
| Q4 | Home CTA label (`5657066` compact) |
| Q5 | Destination section |
| Q6 | Exact focus / hash (Impl 3) |
| Q7 | Domain action (commit point) |
| Q8 | Verified signal / trigger |
| Q9 | Auto-complete path present & authoritative |
| Q10 | Manual Mark complete allowed? |
| Q11 | Luv celebration type (if any) + one-time |
| Q12 | Completes on nav/open? (must be No) |
| Q13 | Completes on type/draft/form start? (must be No) |
| Q14 | Completes on refetch / re-read completed? (must be No) |
| Q15 | Acceptance status |

---

## Live Emma & Jordan snapshot (GET-only, 2026-08-09)

### Venue checklist (`GET /api/portal/tasks`)

| Status | canComplete | Trigger | Title |
| --- | --- | --- | --- |
| complete | false | `contract_signed` | Sign your contract |
| complete | false | null | Choose your package |
| complete | false | `questionnaire_submitted` | Complete your questionnaire |
| complete | false | `document_uploaded_insurance` | Purchase event insurance |
| complete | false | `vendor_selected` | Choose your vendors |
| complete | false | `guest_count_finalized` | Submit your guest count |
| **pending** | **false** | `payment_received` | Final payment |
| complete | false | `seating_submitted` | Submit your seating plan |
| complete | false | `timeline_submitted` | Submit your timeline |
| **pending** | **true** | null | Leave a review |

### Open owned vendor task

| Status | canComplete | Title |
| --- | --- | --- |
| pending | true | Share timeline |

### Payments

Unpaid: First Installment, Second Installment, Final Payment ($12,960 remaining).  
Questionnaire: `submitted`. Timeline unpublished: `false`. No open signable contracts / requests.

### Synthesized open attention (`buildUnifiedTaskList`)

| Kind | CTA | Dest | Focus | completableHere | Title |
| --- | --- | --- | --- | --- | --- |
| payment | Pay now | payments | null | false | First Installment |
| payment | Pay now | payments | null | false | Second Installment |
| payment | Pay now | payments | null | false | Final Payment |
| venue_task | Mark complete | tasks | null | true | Leave a review |

**Checklist “Final payment” suppressed from attention** while unpaid ledger lines exist (Impl 2) — confirmed: `open` does **not** include checklist Final payment; DB row remains `pending`/`canComplete=false`.

Home also overlays owned incomplete vendor tasks → **Share timeline** with underlying action `Complete` → compact **Review** (`5657066`).

---

## Acceptance matrix

Columns: Task | CTA (Tasks) | Destination | Domain Action | Verified Signal | Auto Complete | Luv Celebration | Manual Complete Allowed | Status

| Task | CTA (Tasks) | Destination | Domain Action | Verified Signal | Auto Complete | Luv Celebration | Manual Complete Allowed | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest count | Submit guest count | `#guests/finalize` | `submit_guest_count` | `guest_count_finalized` | SQL loop in RPC | `guest_list_submitted` (one-shot) | **No** | **PASS** |
| Vendor list | Add vendors | `#vendors/pick` | `submit_vendor_list` | `vendor_selected` | SQL loop in RPC | `vendor_list_submitted` (Impl 4) | **No** | **PASS** |
| Seating | Submit seating | `#seating/submit` | `submit_seating_plan` | `seating_submitted` | SQL loop in RPC | `seating_submitted` (Impl 4) | **No** | **PASS** |
| Timeline (playbook) | Submit timeline | `#timeline/submit` | `submit_timeline` | `timeline_submitted` | SQL + Luv | `timeline_submitted` | **No** | **PASS** |
| Timeline unpublished (derived) | Review & submit | `#timeline/submit` | same Submit | unpublished cleared | derived row drops | same Luv on first submit | **No** | **PASS** |
| Contract (playbook) | Review & sign | `#documents/sign` | `/sign/{token}` | `contract_signed` | `triggerAutoComplete` | `contract_signed` | **No** | **PASS** |
| Contract (derived Sign:) | Review & sign | `#documents/sign` | sign flow | status ≠ sent / no token | derived omit | same | **No** | **PASS** |
| Questionnaire (playbook) | Complete form | `#questionnaire/form` | `submit_questionnaire_as_couple` | `questionnaire_submitted` | wired couple RPC (Impl 1) | `questionnaire_submitted` (Impl 4) | **No** | **PASS** |
| Questionnaire (derived) | Complete form | `#questionnaire/form` | same | status === `sent` only | derived omit when submitted | same | **No** | **PASS** |
| Payment line (ledger) | Pay now | `#payments` | checkout / mark paid | line `paid` | derived omit; also fires loose `payment_received` | **No new** celebration; existing `final_payment_received` when readiness complete only | **No** | **PASS** (money) / **INTENTIONAL GAP** (trigger breadth) |
| Final payment (checklist twin) | Pay now *(if visible)* | `#payments` | same money path | `payment_received` | over-broad any-payment autocomplete | **Not** celebrated as `payment_received` | **No** | **PASS** attention suppress (Impl 2) + **INTENTIONAL GAP** trigger |
| Insurance | Upload insurance | `#documents` (no focus) | venue `saveDocument` category insurance **only** | `document_uploaded_insurance` | couple upload **does not** fire | **None** (correct) | **No** (blocked; may strand) | **INTENTIONAL GAP** |
| Leave a review | Mark complete | `#tasks` | none | null | n/a | task confetti only on press | **Yes** (ack) | **PASS** |
| Choose your package | Mark complete *(when open)* | `#tasks` | no couple package SoT | null | n/a | task confetti only | **Yes** (ack / missing domain) | **PASS** (honest manual) |
| Share timeline (vendor) | checkbox / Complete | `#tasks` | none typed | none | n/a | task confetti only | **Yes** (ack) | **INTENTIONAL GAP** (no domain share link) |
| Vendor visible-only | View / no complete | `#tasks` | vendor owns | — | — | — | **No** | **PASS** |
| Requests (derived) | Upload / Respond / Review & respond | `#requests` | request APIs | request status | derived | none required | **No** | **PASS** *(none open on seed)* |

### Q1–Q15 rollup (attention + catalog cases)

| Task | Q3 CTA | Q5 Dest | Q7 Domain | Q8 Signal | Q9 Auto | Q10 Manual | Q11 Luv | Q12–Q14 never on nav/draft/refetch | Q15 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest count | Submit guest count | guests/finalize | submit RPC | guest_count_finalized | Yes | No | guest_list_submitted | Yes | PASS |
| Vendors | Add vendors | vendors/pick | submit RPC | vendor_selected | Yes | No | vendor_list_submitted | Yes | PASS |
| Seating | Submit seating | seating/submit | submit RPC | seating_submitted | Yes | No | seating_submitted | Yes | PASS |
| Timeline | Submit timeline | timeline/submit | submit RPC | timeline_submitted | Yes | No | timeline_submitted | Yes | PASS |
| Contract | Review & sign | documents/sign | sign | contract_signed | Yes | No | contract_signed | Yes | PASS |
| Questionnaire | Complete form | questionnaire/form | couple submit | questionnaire_submitted | Yes | No | questionnaire_submitted | Yes | PASS |
| Payment lines | Pay now | payments | pay | line paid | derived | No | final only (readiness) | Yes | PASS + pay GAP noted |
| Final payment twin | suppressed / Pay now | payments | pay | payment_received | unsafe breadth | No | not for payment_received | Yes | INTENTIONAL GAP |
| Insurance | Upload insurance | documents | venue upload only | document_uploaded_insurance | couple NO | No | none | Yes | INTENTIONAL GAP |
| Leave a review | Mark complete | tasks | ack | null | n/a | Yes | manual confetti only | Yes | PASS |
| Package | Mark complete | tasks | none | null | n/a | Yes | manual only | Yes | PASS |
| Share timeline | Complete @ Tasks | tasks | ack | none | n/a | Yes | manual only | Yes | INTENTIONAL GAP |

Home CTAs (Q4): domain Submit→**Submit**, Pay→**Pay**, Mark complete/Complete→**Review**; navigate-only — confirmed in `compactNextStepsActionLabel` + Next Steps card code.

---

## PASS / FAIL / INTENTIONAL GAPS

### PASS

1. Domain-triggered checklist: `canComplete=false` (SQL + TS defense-in-depth); Tasks CTA navigates with domain verbs.  
2. `complete_portal_task` rejects triggered rows (`domain_verified_use_workspace`) — Impl 1 live proof; code still present in migration.  
3. Questionnaire couple path auto-completes `questionnaire_submitted` (Impl 1).  
4. Impl 2: unpaid ledger lines hide `payment_received` checklist mirrors; Pay now is money SoT; DB twin retained.  
5. Impl 3: structured `#section/focus` deep-links for guest/vendors/seating/timeline/contract/questionnaire; nav/focus never completes.  
6. Impl 4: Luv types extended; vendor/seating/questionnaire celebrate only when `celebrated===true`; seating always-🎉 removed.  
7. Manual tasks without triggers keep Mark complete (Leave a review; owned Share timeline).  
8. No completed-state `useEffect` confetti found on portal domain surfaces; celebration gated on submit response `celebrated`.  
9. Manual `celebrateTaskComplete` remains separate from verified Luv path.  
10. `5657066` Home Review compact intact; Home does not complete.  
11. Unit tests this pass: **61/61 pass**.

### FAIL

**None** against the shipped Impl 1–4 product commitments.

### INTENTIONAL GAPS (confirmed — do not “fix” in this audit)

| Gap | Confirmation |
| --- | --- |
| **Insurance** | Couple Documents upload still does not fire `document_uploaded_insurance`. Manual blocked while trigger set. Escape = venue complete/waive. Emma row is currently `complete` (`completedAt` 2026-08-09) via non-couple path — **does not close** the couple-upload gap. No insurance Luv type. |
| **Share timeline** | Still acknowledgment-only `vendor_tasks`; Mark complete allowed; no typed share/domain auto-complete; notes hygiene only. |
| **Payment celebrations / trigger** | No celebration invented for over-broad `payment_received`. Existing `final_payment_received` (readiness) left unchanged. Trigger narrowing deferred. Attention twin suppress is the safe ship. |

---

## Celebrations audit

| Requirement | Finding |
| --- | --- |
| Durable `luv_celebrations` | Yes — unique `(client_id, celebration_type)` |
| One-time per type/client | Insert `on conflict do nothing` → `celebrated` only when insert wins |
| RPC earns + returns flag | Guest/timeline/contract prior; vendor/seating/questionnaire in `20261234000000_*` |
| UI only when newly celebrated | `shouldPresentVerifiedCelebration` + call sites gate on `celebrated === true` |
| No completed-state useEffect confetti | Not present on verified domain UIs |
| No duplicate on refresh/nav/re-read | Conflict → `celebrated: false` (Impl 4 prior resubmit probes) |
| Manual confetti separate | `celebrateTaskComplete` after Mark complete / vendor complete only |
| Must not celebrate Mark complete as verified Luv | `mayCelebrateManualTaskComplete` denies when trigger set; Impl 1 blocks Mark complete |
| Payment_received new celebration | **Not shipped** (intentional) |

---

## Manual / acknowledgment tasks

| Class | Behavior | Confirmed |
| --- | --- | --- |
| Non-verifiable | Leave a review / package (null trigger) may Mark complete | Yes |
| Vendor owned, no typed domain | Share timeline Mark complete | Yes |
| Domain-verifiable | Mark complete blocked; must use workspace | Yes |
| Fake verified | No — triggered rows never show Mark complete as complete-here | Yes |
| Ack-clear vs fake verified | Manual ack stays honest checklist; verified paths do not pretend Mark complete is the work | Yes |

---

## Tests (this pass — exact)

```bash
npx tsx --test \
  lib/luv/celebrations.test.ts \
  lib/luv/verified-domain-celebrations.test.ts \
  lib/portal/unified-tasks.test.ts \
  lib/portal/next-steps.test.ts \
  lib/portal/workspace-routing.test.ts
```

**Result:** `tests 61` · `pass 61` · `fail 0` · `skipped 0` · `duration_ms ~245–305`.

Note: Impl 4 report cited 82/82; current suite size on this tree is **61** tests covering the same five files — all green.

Prior live QA artifacts (not re-mutated here):  
`docs/qa/couple-task-verified-action-completion/`, `…-payment-attention-impl2/`, `…-workspace-routing-impl3/`, `…-verified-celebrations/` (`summaryPass: true`).

---

## Architectural concerns

1. **`payment_received` remains event-global** — first paid line can still auto-complete Final payment / related mirrors in DB even while couple attention correctly shows Pay now only. Attention fix ≠ trigger correctness.  
2. **Insurance policy vs couple capability mismatch** — couples cannot earn the blocked trigger via portal upload; coordinator escape required until a real insurance document category exists.  
3. **Vendor Share timeline** — product language implies a domain share; implementation is still ack checkbox → trust/explanation debt until typed action exists.  
4. **Portal Mark complete UI confetti** has no durable one-shot store (acceptable for ack-only; must never attach to domain auto-complete).  
5. **Emma seed after Impl 4** is no longer a clean “all open domain tasks” demo — celebration/idempotency live re-proves require careful non-mutating observation or a fresh seed restore (out of audit scope).

---

## Recommended next implementation (only if genuinely justified)

**Justified follow-on (single highest-value WP):** narrow Final / deposit playbook completion so `payment_received` is not “any paid line,” aligned with payment readiness / installment semantics — **without** inventing title matching or payment schema redesign. Keep Impl 2 suppress until then.

**Optional later (not required to accept Impl 1–4):** couple insurance category + share → `document_uploaded_insurance`; typed vendor share-timeline metadata. Do **not** invent celebrations for those until signals exist.

---

## Explicit confirmations

- [x] No code changes  
- [x] No migrations / schema / DB / seed mutations during this audit  
- [x] No new implementation  
- [x] No submit / pay / Mark complete / complete-task POST  
- [x] Intentional gaps confirmed only, not fixed  
- [x] Report written to `docs/qa/couple-task-verified-completion-final-acceptance-audit.md`

---

## Paste-ready report for parent

### Verdict
**PASS** with **3 INTENTIONAL GAPS** (Insurance couple path, Share Timeline ack-only, Payment `payment_received` breadth / no unsafe celebration). **Zero mutations. No product changes.**

### Commits SoT
`5657066` · `0ad64af` · `fc843dc` · `358153b` · `56e98a4` (local)

### Acceptance matrix

| Task | CTA | Destination | Domain Action | Verified Signal | Auto Complete | Luv Celebration | Manual Allowed | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Guest count | Submit guest count | `#guests/finalize` | `submit_guest_count` | `guest_count_finalized` | Yes | `guest_list_submitted` | No | PASS |
| Vendor list | Add vendors | `#vendors/pick` | `submit_vendor_list` | `vendor_selected` | Yes | `vendor_list_submitted` | No | PASS |
| Seating | Submit seating | `#seating/submit` | `submit_seating_plan` | `seating_submitted` | Yes | `seating_submitted` | No | PASS |
| Timeline | Submit timeline | `#timeline/submit` | `submit_timeline` | `timeline_submitted` | Yes | `timeline_submitted` | No | PASS |
| Contract | Review & sign | `#documents/sign` | sign flow | `contract_signed` | Yes | `contract_signed` | No | PASS |
| Questionnaire | Complete form | `#questionnaire/form` | couple submit RPC | `questionnaire_submitted` | Yes | `questionnaire_submitted` | No | PASS |
| Payment lines | Pay now | `#payments` | pay / Stripe | line paid | derived | final readiness only | No | PASS |
| Final payment twin | suppressed (unpaid) / Pay now | `#payments` | pay | `payment_received` (broad) | unsafe breadth | **not** celebrated | No | INTENTIONAL GAP |
| Insurance | Upload insurance | `#documents` | venue insurance doc only | `document_uploaded_insurance` | couple NO | none | No | INTENTIONAL GAP |
| Leave a review | Mark complete | `#tasks` | ack | null | n/a | manual confetti | Yes | PASS |
| Package | Mark complete | `#tasks` | none | null | n/a | manual confetti | Yes | PASS |
| Share timeline | Complete @ Tasks | `#tasks` | ack | none | n/a | manual confetti | Yes | INTENTIONAL GAP |

### Live Emma open attention (GET + synthesis)
Pay now ×3 (installments) · Leave a review (Mark complete) · Share timeline (Home Review / Tasks complete) · Checklist Final payment **hidden** from attention, still `pending`/`canComplete=false`.

### Celebrations
Durable `luv_celebrations` one-shot; UI only if `celebrated===true`; no completed-state useEffect confetti; manual confetti separate; payment_received not added.

### Tests
**61/61 pass** on celebrations + verified-domain-celebrations + unified-tasks + next-steps + workspace-routing.

### Next justified WP (only)
Narrow final/deposit auto-complete semantics for `payment_received` (keep attention suppress until then).

### Explicit
**No changes made.**
