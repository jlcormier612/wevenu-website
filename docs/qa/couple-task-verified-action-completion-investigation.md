# Couple Tasks — Verified Action Completion Investigation

**Date:** 2026-08-09  
**Repo:** `wevenu-website`  
**Scope:** Investigation + this report only. **No code, DB, migrations, or commits.**

**Related shipped work (do not revert):** Issue 1 Home Next Steps CTA remapping (`Mark complete` / `Complete` / checklist → visible **Review**) shipped in `5657066`. That is a Home presentation patch only. This WP documents the deeper verified-completion model and explicitly **stops expanding Incomplete→Review as a product solution**.

**Related prior investigation:** `docs/qa/couple-home-polish-investigation.md` (Issue 2 Final payment twin, Issue 1 CTA surface).

---

## Product model (canonical)

| Layer | Meaning | Must NOT be |
| --- | --- | --- |
| **TASK** | Tells the couple what venue/vendor needs | A checkbox pretending to be the work |
| **CTA** | Takes the couple to the correct workspace | “I finished” / complete-in-place when domain can verify |
| **DOMAIN ACTION** | Actual save / submit / pay / upload / sign | Opening a section, typing, opening a modal, starting a form |
| **COMPLETION SIGNAL** | System detects the requested domain action happened | Navigate / click CTA / focus / draft edits |
| **CELEBRATION** | One-time acknowledgment of newly achieved completion | Re-render of an already-complete row |

**Core rule:** **“Mark complete” is not valid when the system can verify the domain action.**

Completion must fire only on verified domain state — never on open destination, click CTA, typing, modal open, or form start.

---

## 1. Current architecture

### 1.1 Two task stores Couples see

| Store | Table / source | Portal read | Portal complete |
| --- | --- | --- | --- |
| Venue / Client Planning checklist | `event_tasks` (from playbook templates) | `get_portal_tasks` → `resolvePortalTasks` / `GET /api/portal/tasks` | `complete_portal_task` → `POST /api/portal/complete-task` (manual; `completed_by='couple'`, `source_type='manual'`) |
| Vendor → couple shared tasks | `vendor_tasks` (`couple_visibility` ∈ `visible` \| `owned`) | `get_portal_vendor_tasks` | `complete_portal_vendor_task` → `POST /api/portal/complete-vendor-task` |

Draft→Release gate: Client Planning `event_tasks` are invisible until `event_playbook_applications.kind='client'` has `released_at`.

### 1.2 Playbook definitions + `autoCompleteTrigger`

- Template seeds: `lib/playbooks/constants.ts` → `STANDARD_CLIENT_PLANNING_TASKS` / venue planning seeds.
- Trigger catalog: `AUTO_COMPLETE_TRIGGERS` in the same file.
- Row field: `event_tasks.auto_complete_trigger` (mirrored from template at apply).
- Venue builder: `components/playbooks/playbook-builder.tsx` (venues can change triggers / leave manual).

**App-layer auto-complete:**

```text
domain event → triggerAutoComplete(supabase, venueId, eventId, trigger, sourceType?, sourceId?)
            → repo.autoCompleteTrigger(...)
            → for each matching open event_tasks row: completeEventTask(..., "system", ...)
```

Files: `lib/playbooks/service.ts` (`triggerAutoComplete`), `lib/playbooks/repository.ts` (`autoCompleteTrigger`, `completeEventTask`).

**SQL-inline auto-complete (Commitment Lifecycle submits):** domain RPCs update matching `event_tasks` directly by `auto_complete_trigger` (same semantic as `triggerAutoComplete`, but inside SECURITY DEFINER RPCs):

| Trigger | Domain RPC / path |
| --- | --- |
| `guest_count_finalized` | `submit_guest_count` |
| `seating_submitted` | `submit_seating_plan` |
| `vendor_selected` | `submit_vendor_list` |
| `timeline_submitted` | `submit_timeline` |

### 1.3 Unified Tasks + Home Next Steps (attention surfaces)

Couples do **not** only see raw playbook rows. `buildUnifiedTaskList` (`lib/portal/unified-tasks.ts`) synthesizes:

| Kind | Source | `targetSection` | Tasks CTA today | `completableHere` |
| --- | --- | --- | --- | --- |
| `venue_task` | `PortalTask` / `event_tasks` | **`tasks`** (always) | `Mark complete` if `canComplete`, else `View` / `Done` | **true** iff `canComplete` |
| `request` | portal requests | `requests` | Upload / Respond / Review & respond | false |
| `contract` | docs with `docType=contract`, `status=sent`, `signToken` | `documents` | Review & sign | false |
| `payment` | unpaid payment line items (canonical schedules) | `payments` | Pay now | false |
| `questionnaire` | questionnaire `status === 'sent'` | `questionnaire` | Complete form | false |
| `timeline` | `timelineHasUnpublishedChanges` | `timeline` | Review & submit | false |
| vendor (Home only) | `vendor_tasks` owned incomplete | **`tasks`** | Home actionLabel `Complete` → compact **Review** | N/A on Home (navigate only) |

**Critical separation already partially implemented for derived kinds:** payments / contracts / requests / questionnaire / timeline **do not** complete in the Tasks list — they navigate to the owning workspace. Checklist `venue_task` rows **still** complete via manual API.

**Home Next Steps** (`NextStepsCard` in `components/portal/portal-shell.tsx`):

- Reuses `buildUnifiedTaskList` + vendor overlays.
- CTA is navigate-only (`onNavigate(targetSection)`).
- `compactNextStepsActionLabel` (`lib/portal/next-steps.ts`) maps checklist Complete/Mark complete/View/Complete form → **Review** (shipped in `5657066`).  
  **Product note:** Review is Home wording only; it does not implement verified completion.

### 1.4 Venue-side `actionType` / `actionLabel` (not couple portal)

Coordinator playbook UI can attach `actionType` (`vendor_library` | `payments` | `documents` | `guest_list`) → event tab hash via `taskActionHref`. Couple portal unified list **does not consume** `actionType` / `actionLabel` from `event_tasks`. Couple routing is hard-coded by kind in `buildUnifiedTaskList` (always `tasks` for venue_task).

### 1.5 Celebration systems today

| System | When | One-time guarantee | Presentation |
| --- | --- | --- | --- |
| **Luv celebrations** | Real lifecycle milestones only | `luv_celebrations` unique `(client_id, celebration_type)` | `celebrateLuv` + toast |
| Types | `contract_signed`, `final_payment_received`, `guest_list_submitted`, `timeline_submitted`, `website_published` | Insert conflict → `celebrated: false` | `lib/luv/celebrate.ts`, `lib/luv/celebrations.ts` |
| **Task confetti** | Manual portal task / vendor task complete | **None** (fires every successful complete) | `celebrateTaskComplete` in `lib/portal/celebrate-task.ts` |

Domain submits that already celebrate via Luv (with `celebrated` flag): guest count, timeline submit, website publish, contract sign, final payment (coordinator toast when readiness complete).

---

## 2. Every couple-facing task type discovered

Sources: `STANDARD_CLIENT_PLANNING_TASKS`, `buildUnifiedTaskList` kinds, vendor task projection, portal surfaces.

### Master table

| Task type | Example task | Current CTA (Tasks / Home) | Current destination | Current completion mechanism | Existing domain action | Existing completion trigger | Can completion be detected reliably? | Exact event/state that proves completion | What code would need to connect it? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Playbook — contract** | Sign your contract | Tasks: often still `Mark complete` on checklist row **plus** derived `Sign: …` → Review & sign; Home Review | Checklist → `#tasks`; derived → `#documents` / `/sign/{token}` | Manual `complete_portal_task` **and/or** `contract_signed` via `lib/contracts/service.ts` → `triggerAutoComplete` | Couple signs via `/sign/[token]` | `autoCompleteTrigger: contract_signed` + Luv `contract_signed` | **Yes** | Contract row status signed / sign RPC success | Prefer suppress checklist row when open contract obligation exists; keep auto-complete; **disable manual complete** when trigger present |
| **Playbook — package** | Choose your package | Mark complete / Home Review | `#tasks` | Manual only (`autoCompleteTrigger: null`) | No couple “choose package” SoT in portal today (venue package / invoice world) | None | **No today** (no couple domain action) | Future: event order / selected package committed | Until package selection exists for couples: either venue-only task or new domain commit — **do not fake with Mark complete** if product expects a domain choice |
| **Playbook — questionnaire** | Complete your questionnaire | Dual: checklist Mark complete **and** derived “Complete your final details form” → Complete form / Home Review | Checklist `#tasks`; derived `#questionnaire` | Derived row hides when status ≠ `sent`; checklist does **not** auto-complete on couple submit path | `POST /api/public/questionnaire` → `submit_questionnaire_as_couple` (sets `event_questionnaires.status='submitted'`) | Template trigger `questionnaire_submitted`; **wired only** from venue `saveQuestionnaireAction(..., submit=true)` → `triggerAutoComplete` — **not** from couple RPC | **Partial** — questionnaire status is reliable; checklist linkage **broken for couple path** | `event_questionnaires.status ∈ {submitted, reviewed}` | Call `triggerAutoComplete(..., "questionnaire_submitted")` from couple submit path (public API or RPC, same pattern as guest count); remove Mark complete when trigger set |
| **Playbook — insurance doc** | Purchase event insurance | Mark complete / Home Review | `#tasks` (not `#documents`) | Manual; trigger `document_uploaded_insurance` fires only from **venue** `saveDocument` with `category==='insurance'` on event docs | Couple can upload to `couple_documents` via portal Documents (insurance typed in UI metadata) — **does not** call `triggerAutoComplete` | `document_uploaded_insurance` (venue documents path) | **Partial / broken for couple upload** | Venue-visible insurance document attached to event with category insurance | Wire couple insurance share/upload (or document domain event) → same trigger; CTA/nav → `#documents`; disable manual complete when trigger present |
| **Playbook — vendors** | Choose your vendors | Mark complete / Home Review | `#tasks` (not `#vendors`) | SQL auto-complete on `submit_vendor_list` **when** couple Submits list; **manual Mark complete still available** | Pick vendors + `POST /api/portal/vendors/submit` | `vendor_selected` | **Yes** (on Submit, not on pick) | `vendor_selection_submissions` row + task update loop | CTA → `#vendors`; disable manual complete when trigger present; celebration optional (no Luv type today) |
| **Playbook — guest count** | Submit your guest count | Mark complete / Home Review | `#tasks` (not `#guests`) | SQL auto-complete on `submit_guest_count` + Luv `guest_list_submitted`; **manual still available** | `FinalizeGuestCountCard` → `POST /api/portal/guest-count` | `guest_count_finalized` | **Yes** | `guest_count_submissions` insert + `events.guest_count` update | CTA → `#guests` (deep-link to finalize card); disable Mark complete when trigger present |
| **Playbook — seating** | Submit your seating plan | Mark complete / Home Review | `#tasks` (not `#seating`) | SQL auto-complete on `submit_seating_plan`; manual still available | Seating studio submit → `POST /api/portal/seating/submit` | `seating_submitted` | **Yes** | `seating_submissions` row | CTA → `#seating`; disable manual complete when trigger present |
| **Playbook — timeline plan** | Submit your timeline | Mark complete / Home Review | `#tasks` (not `#timeline`) | SQL auto-complete on `submit_timeline` + Luv; derived unified row for unpublished changes navigates to timeline | Edit + `POST /api/portal/timeline/submit` | `timeline_submitted` | **Yes** for whole-timeline Submit | `timeline_submissions` row | CTA → `#timeline`; suppress twin checklist vs unpublished-derived carefully; disable Mark complete |
| **Playbook — final payment** | Final payment | Mark complete (**twin**) / Home Review | `#tasks` **and** payment line “Final Payment” → Pay now / `#payments` | **Broken semantics:** (1) manual Mark complete without pay; (2) `payment_received` auto-completes on **any** paid line item | Mark paid / Stripe PI success | `payment_received` via `markLineItemPaid` + Stripe webhook | **Money yes; task matching no** — trigger is “any payment,” not “this obligation / final balance” | Line item `status=paid` for the intended installment; for “final,” event payment readiness `complete` (already used by Luv `final_payment_received`) | See §6 Issue 2; prefer payment attention row; refine trigger or suppress checklist when unpaid payment rows exist |
| **Playbook — leave review** | Leave a review | Mark complete / Home Review | `#tasks` | Manual only | Soft: portal feedback / platform feedback sheets — not bound to this task | None | **Weak** | e.g. venue feedback submitted post-event if product defines it | Optional: bind to `product-feedback` / NPS submit if product wants verified review; else keep as rare manual exception with honest CTA |
| **Derived — payment line** | First Installment / Final Payment | Pay now / Home **Pay** | `#payments` | Derived: disappears when line `paid` \| `cancelled` | Checkout / mark paid | N/A (state-derived; also fires loose `payment_received` for playbook tasks) | **Yes** | `payment_line_items.status = 'paid'` | Keep as SoT for money; do not add Mark complete |
| **Derived — contract obligation** | Sign: {name} | Review & sign / Home Review | `#documents` / sign URL | Derived: only while `sent` + `signToken` | Sign flow | Also drives `contract_signed` auto-complete | **Yes** | Contract signed status | Keep derived; avoid twin Mark complete checklist |
| **Derived — request** | Venue upload / approval request | Upload / Respond / Review & respond | `#requests` | Derived: excluded when submitted/reviewed/completed/cancelled | Request respond / upload APIs | Request status transitions | **Yes** | Request terminal/waiting statuses already used | Keep; celebration not required |
| **Derived — questionnaire** | Complete your final details form | Complete form / Home Review | `#questionnaire` | Derived from `status==='sent'` | Public questionnaire submit | Status change (see playbook gap above) | **Yes** for list presence | Questionnaire not `sent` | Keep derived list row; connect playbook auto-complete |
| **Derived — timeline unpublished** | Submit your timeline updates | Review & submit / Home Submit | `#timeline` | Derived from `hasUnpublishedChanges` | Timeline Submit RPC | Clears unpublished + triggers playbook `timeline_submitted` | **Yes** | `hasUnpublishedChanges === false` after submit | Keep; align CTA/labels with playbook timeline task |
| **Vendor task — checklist** | e.g. Share timeline (photographer) | Tasks: checkbox complete-in-place; Home: navigate `#tasks` + Review | `#tasks` (not domain workspace) | Manual `complete_portal_vendor_task` only | Often notes describe a domain action (share timeline / upload) with **no** auto link | None | **Usually no** without typed action | Case-by-case: e.g. timeline entry has `guest` audience; file uploaded; etc. | Prefer optional `actionType`/target on vendor tasks later; until then Nav CTA into workspace; Mark complete only when no verifiable domain |
| **Personal todos** | Couple Plans / todos | Continue Plans (Your Wedding) | `#todos` | Local couple todos — **not** Next Steps | Todo CRUD | N/A for venue obligations | N/A | N/A | Keep out of Next Steps (already separate) |

---

## 3. Existing completion mechanisms

### 3.1 Manual complete APIs (trust hazard when domain exists)

| API | RPC | Who | Effect |
| --- | --- | --- | --- |
| `POST /api/portal/complete-task` | `complete_portal_task` | Couple (`client_owned`, released playbook) | Sets `event_tasks.status=complete`, **ignores** whether domain action occurred; does **not** check `auto_complete_trigger` |
| `POST /api/portal/complete-vendor-task` | `complete_portal_vendor_task` | Couple if `couple_visibility='owned'` | Completes `vendor_tasks` |
| Venue coordinator complete | `completeEventTask` / playbook actions | Staff | Same table; may notify |
| Vendor app complete | `completeEventTask` / vendor actions | Vendor | Event / vendor surfaces |

### 3.2 `triggerAutoComplete` call sites (app)

| Trigger | Caller |
| --- | --- |
| `payment_received` | `lib/payments/service.ts` `markLineItemPaid`; `lib/stripe/webhook-handlers.ts` |
| `contract_signed` | `lib/contracts/service.ts` |
| `questionnaire_submitted` | `app/(app)/events/[id]/questionnaire-actions.ts` (venue submit path only) |
| `document_uploaded` / `document_uploaded_insurance` | `lib/documents/service.ts` `saveDocument` (venue event docs) |
| `floor_plan_created` | `lib/floor-plans/service.ts` |
| `timeline_created` | `app/(app)/events/[id]/timeline-actions.ts` (venue timeline entries) |

### 3.3 SQL Commitment Lifecycle auto-complete

Guest count, seating, vendor list, timeline submit RPCs (see §1.2).

### 3.4 Derived completion (no checklist write)

Unified list drops/omits rows when owning system state says done (paid, signed, request closed, questionnaire not `sent`, timeline unpublished false). **This is the correct pattern for verified completion presentation.**

---

## 4. Existing domain actions (couple-relevant)

| Domain | Commit point | Endpoint / RPC | Side effects already wired |
| --- | --- | --- | --- |
| Guest count | Submit final count | `POST /api/portal/guest-count` → `submit_guest_count` | Updates `events.guest_count`, auto-complete `guest_count_finalized`, Luv `guest_list_submitted` |
| Guests (list draft) | Add/edit RSVPs | portal guests APIs | **Not** playbook completion (correct) |
| Vendors | Submit selected list | `POST /api/portal/vendors/submit` → `submit_vendor_list` | Snapshot + assignments + auto-complete `vendor_selected` |
| Seating | Submit plan | `POST /api/portal/seating/submit` → `submit_seating_plan` | Snapshot + auto-complete `seating_submitted` |
| Timeline | Submit updates | `POST /api/portal/timeline/submit` → `submit_timeline` | Snapshot + auto-complete `timeline_submitted` + Luv |
| Timeline edit / visibility | Draft / audience | timeline add/update/visibility routes | Unpublished flag; **Share timeline** for guests is audience/visibility — **not** bound to vendor_tasks |
| Questionnaire | Submit form | `POST /api/public/questionnaire` → `submit_questionnaire_as_couple` | Status `submitted` + thread message; **missing playbook auto-complete** |
| Payments | Pay | portal checkout + Stripe webhooks / venue mark paid | Line paid + loose `payment_received` auto-complete + Luv final when readiness complete |
| Documents (couple) | Upload / share | `POST /api/portal/upload` + `POST /api/portal/documents` → `couple_documents` | **No** playbook triggers |
| Documents (venue/event) | Upload | `saveDocument` | `document_uploaded` (+ insurance) |
| Contracts | Sign | `/sign/[token]` | `contract_signed` + Luv |
| Requests | Respond / upload | portal request routes | Status-derived list |
| Website | Publish | website portal routes | Luv `website_published` only — not a Client Planning seed task |
| Vendor tasks | Manual checkbox | `complete-vendor-task` | Confetti via `celebrateTaskComplete` |

---

## 5. Completion gaps

1. **TASK / CTA / COMPLETION conflation on checklist rows**  
   All `client_owned` incomplete tasks get `canComplete: true` and Tasks CTA **Mark complete**, even when `auto_complete_trigger` is set and domain submit already exists.

2. **Wrong `targetSection` for domain playbook tasks**  
   Every `venue_task` targets `#tasks`. Couples open Tasks and check a box instead of Guests / Vendors / Timeline / Payments / Documents / Seating / Questionnaire.

3. **Issue 2 — Final payment twin + over-broad `payment_received`**  
   - Dual rows: playbook “Final payment” (Mark complete) + ledger “Final Payment” (Pay now).  
   - Any payment (deposit or installment) calls `triggerAutoComplete(..., "payment_received")`, which can complete **Final payment** (and venue “Verify deposit”) on the **first** payment, not when the final obligation is paid.  
   - Luv correctly distinguishes **final** via `computePaymentsReadiness === complete`; playbook trigger does not.

4. **Questionnaire couple path does not fire `questionnaire_submitted`**  
   Derived unified row works; playbook checklist can remain open → invites Mark complete after real submit.

5. **Insurance / couple documents path does not fire `document_uploaded_insurance`**  
   Venue upload path does; couple Documents upload does not.

6. **Home “Review” is presentation-only**  
   Shipped in `5657066`. Correct stopgap for navigate-only Home. **Not** a completion model. Do not expand Incomplete→Review further as the product fix.

7. **Vendor “Share timeline”**  
   Demo notes hygiene only (`scripts/local-qa/fix-share-timeline-demo-notes.sql`). Domain completion (guest audience / guest timeline visibility) is not linked; couple Mark complete remains the only signal.

8. **Celebrations**  
   Manual task complete always confetti’s (`celebrateTaskComplete`) with no one-time store. Domain Luv celebrations are correctly one-time but cover only 5 milestones — not seating/vendors/insurance/etc.

9. **No new generic completion table should be introduced yet**  
   Prefer existing triggers, submission tables, payment statuses, questionnaire status, request statuses, `luv_celebrations` uniqueness pattern.

---

## 6. Recommended completion trigger for each task type

| Task type | Recommended COMPLETION SIGNAL | Mechanism |
| --- | --- | --- |
| Sign contract | Contract signed | Existing `contract_signed` → keep; **block manual** when trigger set |
| Choose package | Deferred until couple package-commit exists | Do not invent title match; keep manual only if product accepts checklist semantics, else remove from client_owned |
| Questionnaire | `event_questionnaires.status` submitted/reviewed | Fire `questionnaire_submitted` from couple submit path (mirror guest count SQL or public API `triggerAutoComplete`) |
| Insurance | Insurance document present & shared/visible to venue | Prefer event document category insurance **or** couple_documents insurance + `share_with_venue` → fire `document_uploaded_insurance` |
| Choose vendors | Vendor list **Submit** | Keep `vendor_selected` SQL loop; **block manual** |
| Guest count | Guest count **Submit** | Keep `guest_count_finalized`; **block manual** |
| Seating | Seating **Submit** | Keep `seating_submitted`; **block manual** |
| Timeline (playbook) | Timeline **Submit** | Keep `timeline_submitted`; **block manual** |
| Final payment (playbook) | See Issue 2 below | Prefer hide from couple attention; eventual trigger should be final-balance / line-link — **not** “any payment” |
| Leave a review | Optional feedback submit | Else honest manual exception |
| Payment line (derived) | Line paid | Already correct |
| Contract (derived) | Signed / no longer `sent` | Already correct |
| Request | Request status | Already correct |
| Timeline unpublished (derived) | Submit clears flag | Already correct |
| Vendor task | Prefer domain when typed; else manual owned checkbox | No new tables; optional future action metadata on `vendor_tasks` |

### Issue 2 — Final payment twin / `payment_received` → `triggerAutoComplete`

**Investigate (recommend; do not implement here):**

1. **Attention composition (preferred first):** In `buildUnifiedTaskList`, when unpaid payment line items exist for the event, **omit or demote** `venue_task` rows that are financial mirrors with `autoCompleteTrigger === 'payment_received'` (or category financial Final payment). Leave DB rows for venue readiness. **Do not title-dedupe; do not delete rows; do not change payment schema.**  
2. **Trigger semantics (follow-on):** Narrow “Final payment” so it does not complete on deposit. Options (prefer existing state machines):  
   - New trigger e.g. `final_payment_received` aligned with Luv / payment readiness complete; or  
   - Only auto-complete when the paid line item is the schedule’s final installment / readiness flips to complete.  
   Keep deposit verification as a **venue** task with a tighter trigger if needed.  
3. **Until fixed:** Couple path of truth for money is **Pay now** on payment lines — never Mark complete on the checklist twin.

Coordinator “Verify deposit” sharing the same `payment_received` trigger is the same over-broad bug on the venue side; fix carefully so deposit verification still completes on deposit, not only on final.

---

## 7. Recommended CTA for each task type

Principle: CTA names the **domain action the destination will perform**, never “Mark complete” when verification exists. Home may continue short verbs (Pay / Submit / Upload / Review) **as navigation labels only**.

| Task type | Recommended CTA (Tasks) | Home compact (ok to keep/evolve later) |
| --- | --- | --- |
| Contract | Review & sign | Review |
| Package | Open package / View (until domain exists) | Review |
| Questionnaire | Complete form | Review → prefer **Open form** later |
| Insurance | Upload insurance | Upload |
| Vendors | Choose vendors / Submit list | Review → prefer **Open vendors** |
| Guest count | Submit guest count | Submit |
| Seating | Submit seating | Submit |
| Timeline | Submit timeline | Submit |
| Final payment checklist | **Suppress** when payment row exists; else Pay (navigate) — never Mark complete | Pay |
| Payment line | Pay now | Pay |
| Request upload | Upload | Upload |
| Request approval | Review & respond | Review / Approve |
| Leave a review | Leave review (navigate to feedback) or Mark complete if truly checklist-only | Review |
| Vendor owned task (no domain) | Mark complete (exception) | Review (navigate to Tasks) |
| Vendor owned with domain (future) | Share timeline / Upload / etc. | Matching short verb |

**STOP:** Expanding Incomplete→Review as product direction in code. Review remains the temporary Home compact label from `5657066`.

---

## 8. Recommended navigation target / deep-link requirement

Portal already supports `#section` deep links (`portal-shell` hash → `activeSection`). Missing: **within-section focus** (e.g. scroll to Finalize Guest Count).

| Task type | Target `PortalSection` | Deep-link / focus requirement |
| --- | --- | --- |
| Contract / insurance docs | `documents` | Prefer contract needing signature / insurance upload control |
| Questionnaire | `questionnaire` | Open form in section |
| Vendors | `vendors` | Submit list control |
| Guest count | `guests` | Focus `FinalizeGuestCountCard` (not just guest list edit) |
| Seating | `seating` | Submit seating control |
| Timeline | `timeline` | Submit bar |
| Payments / Final payment | `payments` | Focus unpaid line / checkout for that id (`payment_{lineItemId}` already in unified id) |
| Requests | `requests` | Focus request id |
| Vendor checklist (no domain) | `tasks` | Vendor band / task id |
| Package (today) | TBD / venue-driven | Do not invent website/Studio links |

**Do not** send verifiable domain tasks to `#tasks` as the primary CTA destination.

---

## 9. Celebration architecture recommendation

Reuse what exists; do not add a generic completion celebration table in v1.

| Moment | Recommendation |
| --- | --- |
| Domain milestones already in Luv | Keep `luv_celebrations` + `celebrated` flag + `celebrateLuv` — one-time, never on re-render |
| Seating / vendors / insurance / questionnaire | Prefer extending **Luv-style one-time insert** only if product wants milestone moment; otherwise silent list removal is enough |
| Manual checklist / vendor checkbox (non-verifiable only) | `celebrateTaskComplete` OK; still optionally gate with local “just completed” transition (already only on success response) |
| Auto-complete via system | Prefer Luv or none — **do not** fire task confetti when couple did not press Mark complete (avoid surprise on pay / webhook) |
| Re-open portal with already-complete tasks | Never celebrate |

**Anti-patterns:** celebrating on navigate, form open, typing, or refetch of completed state.

---

## 10. Files / components / API routes likely to change

*(Future implementation — not this WP.)*

| Area | Likely touchpoints |
| --- | --- |
| Unified list / CTAs / destinations | `lib/portal/unified-tasks.ts`, `lib/portal/unified-tasks.test.ts`, `components/portal/unified-tasks-section.tsx` |
| Home Next Steps composition | `components/portal/portal-shell.tsx` (`NextStepsCard`), `lib/portal/next-steps.ts` / tests (wording only if needed) |
| Portal canComplete policy | `get_portal_tasks` / `complete_portal_task` SQL (new migration later) — refuse manual complete when `auto_complete_trigger IS NOT NULL` (or allow waiver exception for staff only) |
| Questionnaire couple path | `app/api/public/questionnaire/route.ts` and/or `submit_questionnaire_as_couple` RPC |
| Couple insurance docs | `app/api/portal/documents/route.ts` and/or document-domain share path → `triggerAutoComplete` |
| Payment twin / trigger | `lib/portal/unified-tasks.ts` (suppress); later `lib/payments/service.ts` + Stripe webhook + possibly new trigger constant in `lib/playbooks/constants.ts` |
| Deep links | `portal-shell` navigate helpers; section components (guest finalize, payments line focus) |
| Celebrations | extend `luv_celebrations` types **only** if product adds milestones; otherwise leave |

---

## 11. Files / components that must remain untouched

*(For this investigation: nothing was changed. For future implementation recommendations — treat as sacred unless a dedicated WP says otherwise.)*

| Must remain untouched | Why |
| --- | --- |
| Wedding website renderer / Studio / Collection / Photo Style | Unrelated to task completion |
| Payment schema / schedule / Stripe collection architecture | Twin is attention + trigger semantics, not ledger redesign |
| Vendor architecture (assignments, vendor app core) | Do not redesign; vendor_tasks projection may gain optional navigation metadata later only |
| Tasks destination **behavior redesign as a product rewrite** | Surgical: routing + when Mark complete is allowed — not a new Tasks product |
| Existing domain submit RPCs’ core commit semantics | Wire missing auto-completes; do not redefine what Submit means |
| Existing completion APIs’ auth model | May tighten “when allowed,” not invent parallel complete endpoints |
| `5657066` Home Review CTA remapping | Do not revert as part of verified-completion work |
| New generic completion tables (for now) | Prefer triggers + domain tables |

---

## 12. Regression risks

| Risk | Why it matters |
| --- | --- |
| Blocking Mark complete for all triggered tasks | Custom venue tasks with broken/unused triggers could strand couples — need escape hatch (venue waive / coordinator complete) |
| Suppressing Final payment checklist too broadly | Title matching is dangerous; gate on `auto_complete_trigger` / category / explicit financial mirror rules |
| Narrowing `payment_received` | Deposit verification / mid installments may stop auto-completing — intentional; needs deliberate deposit trigger |
| Questionnaire auto-complete on couple submit | Double-fire with venue path — must be idempotent (already is: status complete skip) |
| Couple insurance → event document trigger | Wrong category or private (unshared) upload must not complete |
| Celebrations on webhook pay | Do not show couple confetti if they’re not in session; Luv final is coordinator-oriented today |
| Changing Tasks in-place complete for Home | Home must stay navigate-only (Spec) |
| Vendor Share timeline auto-complete via title match | Forbidden — use typed action or leave manual |

---

## 13. Recommended implementation sequence

1. **Policy spike (small, high trust):** When `auto_complete_trigger` is set, `canComplete=false` in portal + `complete_portal_task` rejects; Tasks CTA becomes navigate verb; map `targetSection` by trigger (not title).  
2. **Wire missing domain → trigger:** questionnaire couple submit; couple insurance shared upload.  
3. **Issue 2 attention fix:** suppress playbook `payment_received` mirrors when unpaid payment lines exist (`buildUnifiedTaskList`). Verify pay still auto-completes venue readiness separately.  
4. **Issue 2 trigger refinement:** introduce readiness/final-aware completion for Final payment; split deposit verification.  
5. **Deep links:** guest finalize, payment line focus, seating/timeline submit affordances.  
6. **Celebrations:** only for newly verified domain transitions with one-time storage; stop expanding task confetti to domain websockets.  
7. **Vendor tasks (later):** optional action targets for typed shares (timeline audience, upload) — no title matching.  
8. **Do not lead with:** Home Incomplete→Review expansions, payment schema redesign, website/Studio changes, generic completion tables, deleting `event_tasks` rows.

---

## Appendix A — Standard Client Planning seed (`lib/playbooks/constants.ts`)

| Title | `autoCompleteTrigger` | `isRequired` |
| --- | --- | --- |
| Sign your contract | `contract_signed` | true |
| Choose your package | `null` | true |
| Complete your questionnaire | `questionnaire_submitted` | true |
| Purchase event insurance | `document_uploaded_insurance` | true |
| Choose your vendors | `vendor_selected` | false |
| Submit your guest count | `guest_count_finalized` | true |
| Submit your seating plan | `seating_submitted` | true |
| Submit your timeline | `timeline_submitted` | true |
| Final payment | `payment_received` | true |
| Leave a review | `null` | false |

---

## Appendix B — Separation reminder

| Concept | Example |
| --- | --- |
| TASK | “Submit your guest count” |
| CTA | “Submit guest count” → `#guests` |
| DOMAIN ACTION | POST `submit_guest_count` with count |
| COMPLETION SIGNAL | RPC updates task via `guest_count_finalized` |
| CELEBRATION | `luv_celebrations.guest_list_submitted` once + `celebrateLuv` only if `celebrated` |

Opening Guests, editing RSVPs, focusing the finalize card, or clicking Review on Home must **never** complete the task.

---

## Appendix C — Investigation constraints confirmation

- **Code modified:** none (report file only).  
- **Database / migrations:** none.  
- **Commits:** none.  
- **Issue 1 Review CTA:** left as shipped in `5657066`; not expanded as the verified-completion solution.
