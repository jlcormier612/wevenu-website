# Couple Home — Surgical Polish Investigation

**Date:** 2026-08-09  
**Environment probed:** `http://localhost:3000` · portal token `seedcoupleportal00000000000000000000000000000001` (Emma & Jordan · Sweet Daisy Barn & Farm)  
**Scope:** Issues 1–3 from `docs/qa/couple-home-final-acceptance-review.md` §14  
**Method:** Code + live portal API read (`/api/portal/tasks`, `/api/portal/payments`) + seed/template inventory  
**Constraints honored:** No code changes · no DB writes · no migrations · no refactors · no commits  

---

## 1. Issue 1 — Home Next Steps CTA labeled “Complete”

### Findings

| Question | Answer |
|----------|--------|
| Exact component/file that renders the label | `NextStepsCard` → `renderRow` in `components/portal/portal-shell.tsx`. The CTA button text is `{cta}` where `cta = compactNextStepsActionLabel(t)`. |
| Exact helper that determines the CTA label | `compactNextStepsActionLabel` in `lib/portal/next-steps.ts`. Venue checklist rows enter with `actionLabel: "Mark complete"` (from `buildUnifiedTaskList`); vendor rows are synthesized in `NextStepsCard` with hardcoded `actionLabel: "Complete"`. Both compact to visible **“Complete”**. |
| Exact navigation when clicked | `onClick={() => onNavigate(t.targetSection)}` on both the row button and the CTA. Parent passes `setActiveSection`, so this switches portal section in-shell (same as nav), not a full page reload. Typical targets: `tasks` (venue_task / vendor_task), `payments` (payment), `timeline` / `documents` / etc. for other kinds. |
| Completes in place on Home? | **No.** Home never calls `/api/portal/complete-task` or `/api/portal/complete-vendor-task`. Click only navigates. |
| Tasks remains SoT? | **Yes.** Execution (Mark complete / Pay now / vendor complete) lives in `components/portal/unified-tasks-section.tsx` (and Payments for pay). Build spec Part 18 + log: navigate, no complete-in-place on Home. |
| Label change can be Home presentation only? | **Yes.** `compactNextStepsActionLabel` is Home-only presentation over existing `actionLabel`s. Changing it does not alter Tasks CTAs or completion APIs. |

### Live proof of compaction

| Source `actionLabel` / kind | Home CTA |
|-----------------------------|----------|
| `Mark complete` / `venue_task` (e.g. Purchase event insurance, Final payment, Submit your timeline) | **Complete** |
| Hardcoded `Complete` / `vendor_task` (Share timeline) | **Complete** |
| `Pay now` / `payment` | **Pay** |

### Exact SoT

- **Presentation of Home CTA copy:** `lib/portal/next-steps.ts` (`compactNextStepsActionLabel`)  
- **Row render / click wiring:** `components/portal/portal-shell.tsx` (`NextStepsCard`)  
- **Underlying action vocabulary:** `lib/portal/unified-tasks.ts` (`actionLabel`, `targetSection`)  
- **Execution SoT:** Tasks (`UnifiedTasksSection`) + owning sections (Payments, etc.)

### Production vs seed

**Product code path — production.** Any incomplete completable venue/vendor task shown on Home gets a compacted “Complete” CTA today. Not seed-specific.

### Smallest safe fix

**Home presentation only:** change `compactNextStepsActionLabel` so navigational checklist actions no longer say “Complete”.

Recommended mapping (meaning: open/review this item in Tasks; do not imply finish here):

- `Mark complete` / bare `Complete` / `venue_task` / `vendor_task` → **`Open`** (or **`Review`** if product prefers softer language)
- Keep **`Pay` / `Submit` / `Upload` / `Approve` / `Review`** paths as they already navigate correctly

Do **not**:

- Add complete-in-place on Home  
- Change Tasks `actionLabel` (“Mark complete”)  
- Change `onNavigate` targets or completion APIs  

### Files that would need to change

- `lib/portal/next-steps.ts` (`compactNextStepsActionLabel`)
- `lib/portal/next-steps.test.ts` (asserts currently expect `"Complete"` for Mark complete)

Optional (only if copy should appear in aria without relying on compact helper): none required — aria already uses `Action: ${cta}`.

### Files that MUST NOT change (for this issue)

- `components/portal/unified-tasks-section.tsx` (execution)
- `lib/portal/unified-tasks.ts` (Tasks SoT labels / completableHere)
- `/api/portal/complete-task`, `/api/portal/complete-vendor-task`, playbooks RPCs
- Venue / vendor / website surfaces

---

## 2. Issue 2 — Tasks “Final payment” vs “Final Payment”

### Findings

Observed together on Tasks (`docs/qa/couple-home-final-acceptance/qa-results-2.json` and live APIs):

| Surface title | CTA | Kind | Live ID | Table / source |
|---------------|-----|------|---------|----------------|
| **Final payment** | Mark complete | `venue_task` | `d315e9d6-cbf2-4161-baeb-979abbebb74d` | `event_tasks` — Client Planning playbook task |
| **Final Payment** | Pay now | `payment` | `dbb97688-f9d5-477a-9f6e-ae46df67465c` | `payment_line_items` — schedule installment |

#### 1–2. Which record creates each? Venue task vs payment line?

- **Final payment:** Venue/couple planning checklist. Default template in `lib/playbooks/constants.ts` → `STANDARD_CLIENT_PLANNING_TASKS` title `"Final payment"`, `category: "financial"`, `autoCompleteTrigger: "payment_received"`, `ownerType: "couple"`, `visibility: "client_owned"`, `daysOffset: -30`, `isRequired: true`. Instantiated onto the event as an `event_tasks` row when the Client Planning playbook is applied.
- **Final Payment:** Financial ledger installment. Created as `payment_line_items.label = 'Final Payment'` on the event’s payment schedule (stock fixture in `supabase/seed.sql`; live schedule `Payment Schedule — Emma / Carter / Jordan / Lee`, invoice-linked). Portal synthesis: `buildUnifiedTaskList` → `kind: "payment"`, `targetSection: "payments"`, `actionLabel: "Pay now"`.

#### 3. Same real-world obligation?

**Conceptually yes** on this seed: both due **2026-09-17**, both about the final amount owed to the venue (~$4,321 / schedule third). They are **not the same database row**.

#### 4. Different IDs?

**Yes** — `event_tasks.id` ≠ `payment_line_items.id` (IDs above). Unified list IDs: `task_d315e9d6-…` vs `payment_dbb97688-…`.

#### 5. Different completion / payment behavior?

**Yes — critically different:**

| | Final payment (task) | Final Payment (line item) |
|--|----------------------|---------------------------|
| Couple action on Tasks | `Mark complete` → `POST /api/portal/complete-task` → can complete checklist **without** paying | `Pay now` → navigate to Payments |
| Owning system | Playbooks / `event_tasks` | Payments / `payment_line_items` (+ invoice balance) |
| Intended linkage | Template `autoCompleteTrigger: "payment_received"`; `markLineItemPaid` / Stripe webhook call `triggerAutoComplete(..., "payment_received", ...)` which completes matching open `event_tasks` | Ledger status `pending` → `paid` via mark-paid / collection |

So the playbook task is a **checklist mirror intended to auto-complete when money lands**; the line item is the **real money obligation**. Manual Mark complete without payment is still possible today and is a trust hazard if couples treat Mark complete as “paid.”

#### 6. Intentional vs duplicate?

**Intentional dual-system representation**, not a botched duplicate schedule.

Evidence against “accidental twin schedules”:

- `selectCanonicalPaymentSchedules` already collapsed **duplicate payment schedules** for one invoice (Impl 1 reconcile). Live probe: **1** schedule, **3** distinct installments. That canonicalizer does **not** suppress playbook financial tasks.
- Template + payments constants both deliberately name a final payment concept (`"Final payment"` playbook task vs `"Final Payment"` / `"Final Payment (50%)"` schedule presets).

It **feels** like a duplicate to couples because titles differ only by capitalization and both appear in one Tasks list.

#### 7. Seed-only or production-possible?

**Production-possible** whenever both exist for an event:

1. Client Planning playbook applied (includes Final payment task), and  
2. A payment schedule with an unpaid Final Payment (or similarly labeled) installment.

Stock `supabase/seed.sql` creates the **payment** fixture only (not event playbook tasks / vendor tasks). This Sweet Daisy local environment is **enriched beyond stock seed** (renamed venue, applied playbook, vendor tasks). The twin pattern is therefore **not “seed bug only”** — seed merely demonstrates a common production combo.

#### 8. Existing canonicalization that should handle this?

**No, not today.**

- `selectCanonicalPaymentSchedules` (`lib/portal/payment-schedules.ts`): one plan per `invoice_id` — schedules only.  
- `buildUnifiedTaskList`: emits **all** incomplete venue tasks **and** all unpaid line items — no cross-kind suppression for financial playbook tasks.

#### 9. Smallest safe correction (evidence-based)

**Do not** treat as a title-dedupe or row-deletion problem.

**Recommended smallest safe product correction (when implementing later):**

1. **Prefer payment path in unified attention** inside `buildUnifiedTaskList`: when unpaid payment line item(s) exist for the event, **omit from the couple attention list** (or demote to non-actionable) venue_tasks that are financial / named Final payment / wire to `payment_received` — **leave the `event_tasks` row in the DB** for venue readiness + auto-complete.  
2. Couple then sees one clear action: **Pay now → Payments**. Auto-complete still clears the checklist when payment lands.

Safer **interim** options that avoid synthesis changes:

- **Demo/fixture hygiene only:** waive or complete the Final payment `event_tasks` row in local QA data (does **not** fix production).  
- **Template future-only:** stop shipping Final payment as a couple-completable checklist in `STANDARD_CLIENT_PLANNING_TASKS` for **new** playbooks — does **not** fix existing events; needs product sign-off.

**Reject as the primary “fix” without a larger decision:**

- Title-casing dedupe alone  
- Deleting either record  
- Payment schedule model / architecture changes  
- Changing Mark complete semantics globally on Tasks for all venue tasks  

### Exact SoT

| Concern | SoT |
|---------|-----|
| Checklist existence / required readiness | `event_tasks` (+ playbook templates) |
| Money owed / paid | `payment_line_items` (+ schedule / invoice) |
| Couple attention list composition | `buildUnifiedTaskList` (shared Home + Tasks) |
| Schedule duplicate collapse | `selectCanonicalPaymentSchedules` (schedules only) |
| Auto-link pay → checklist | `payment_received` → `autoCompleteTrigger` / `triggerAutoComplete` |

### Production vs seed

**Architectural dual path — production.** Local seed/QA makes it visible; not limited to one fixture title collision.

### Files that would need to change (if implementing the recommended synthesis approach)

- `lib/portal/unified-tasks.ts` (+ tests in `lib/portal/unified-tasks.test.ts`)
- Possibly `lib/portal/next-steps.test.ts` if Home counts/order expectations shift
- **Not required:** seed SQL, payments schema, Tasks UI chrome, Payments UI

Alternative future-template path: `lib/playbooks/constants.ts` only (new events).

### Files that MUST NOT change (for a surgical polish)

- Payment schedule schema / RPCs / mark-paid ledger semantics  
- Deleting `event_tasks` or `payment_line_items` via migration  
- Home-only title hacks that leave Tasks still twinning (if the goal is Tasks twinning)  
- Website / venue coordinator task UI redesign  

---

## 3. Issue 3 — Share timeline copy (“Please ensure the times…”)

### Findings

Exact text (current):

> Please ensure the times of the different aspects of the event that impact my participation is supplied 2 weeks before the event, so I know when to be where.

#### 1. Exact DB record / template / seed?

**Live `vendor_tasks` row** (not `event_tasks`, not stock seed):

| Field | Value |
|-------|--------|
| `id` | `90eff479-b947-41a1-bcca-8496e004fcad` |
| `title` | Share timeline |
| `notes` | *(exact copy above)* |
| `dueDate` | `2026-10-03` |
| `status` | `pending` |
| `coupleVisibility` | `owned` (couple can complete) |
| `canComplete` | `true` |
| `vendorId` | `c825a73a-a13a-44b6-bc75-1029a56fbfb8` |
| `vendorName` | **Golden Hour Photography** |

Source API: `GET /api/portal/tasks` → `vendorTasks` via RPC `get_portal_vendor_tasks`.

Home surfaces `notes` as the Next Steps row `description` (`NextStepsCard` maps `description: t.notes || …`).

**Not present** in `supabase/seed.sql` (stock seed creates a preferred photographer assignment but **no** `vendor_tasks` rows and no this notes string).

Sibling Golden Hour tasks use the same first-person vendor voice and, where present, attachments under `vendors/.../task-templates/...`, which is consistent with **vendor-authored template packs → applied `vendor_tasks`**, not Wevenu system copy.

#### 2–4. Default task template? Venue-authored? System-generated?

| Hypothesis | Verdict |
|------------|---------|
| Default **venue** Client Planning template | **No** — venue list has “Submit your timeline” with different, couple-facing description |
| Venue staff–authored `event_tasks` | **No** — record is `vendor_tasks` |
| System-generated Wevenu string | **No** — no matching string in app code/constants; first-person “my participation” is vendor voice |
| **Vendor-authored** (direct or via vendor task template item notes) | **Yes** |

#### 5. Would changing a default affect existing customer tasks?

**No for existing rows.** `vendor_tasks.notes` is snapshotted on the instance. Editing a future default template / pack item would affect **newly applied** tasks only, not this row (unless a separate “sync from template” feature exists — none found for rewriting couple-visible notes on apply).

#### 6. Elsewhere?

Same vendor’s projected tasks include similar first-person ops notes, e.g.:

- “Provide schedule for event…” notes mentioning “my participation”  
- Calendar-link / “please message me” notes  

So this is a **content pattern**, not a one-off string bug in Home.

Also distinct from venue task **Submit your timeline** (`event_tasks` id `c356e506-…`, description: “Plan your day-of schedule, then submit it so your venue has it.”).

#### 7. Venue / vendor / couple-facing distinction?

| Audience | Copy owner |
|----------|------------|
| Couple portal Home/Tasks | Displays vendor `notes` verbatim when projected (`couple_visibility` owned/visible) |
| Vendor workflow | Authors title/notes (and templates) |
| Venue playbook | Separate SoT (`event_tasks`) — not this string |

Hospitality failure is **couple-facing presentation of vendor-ops first person**, not a venue branding bug.

#### 8. Smallest safe place to improve couple-facing wording

**Preferred (content, no product rewrite engine):**

1. **Local QA / demo fixture hygiene:** edit this vendor task’s `notes` (and optionally template item notes that mint future copies) via vendor UI — couple wording, no first-person vendor “my.”  
2. **Do not** rewrite customer production `vendor_tasks` via migration.  
3. **Do not** change Home to silently rephrase arbitrary vendor notes (vendor workflow fidelity).

**Optional later presentation polish (only if product wants defense-in-depth):** truncate/hide long vendor notes on Home while keeping full notes on Tasks — still not a rewrite of vendor content.

### Exact SoT

- **Storage:** `vendor_tasks.notes` (+ optional `vendor_task_template_items.notes` for future applies)  
- **Projection:** `get_portal_vendor_tasks` → `resolvePortalVendorTasks`  
- **Home display:** `NextStepsCard` description from vendor `notes`  
- **Not SoT:** playbooks defaults, seed.sql, marketing copy

### Production vs seed

**Production-possible vendor content.** This local row is **fixture/demo data beyond stock seed**, but any vendor can publish identical tone to couples today.

### Files that would need to change

- **Ideal for polish:** none in app code — data/content edit only for the demo vendor task (and template item if seeding future applies).  
- If adding optional Home clamp later: `components/portal/portal-shell.tsx` (`NextStepsCard` description handling) only.

### Files that MUST NOT change

- Bulk SQL updates of customer `vendor_tasks`  
- Vendor completion APIs / couple_visibility model  
- Venue “Submit your timeline” playbook copy (different obligation)  
- Silent AI rewrite layer in couple Home  

---

## 4. Exact SoT summary (all three)

| Issue | Couple-facing symptom | Exact SoT |
|-------|----------------------|-----------|
| 1 Complete CTA | Button says Complete on Home | Home label helper `compactNextStepsActionLabel`; click → section navigate; execution stays on Tasks/Payments |
| 2 Final payment twin | Two near-identical money rows on Tasks | `event_tasks` checklist + `payment_line_items` ledger; list composition `buildUnifiedTaskList`; schedule dedupe only covers schedules |
| 3 Share timeline copy | First-person vendor paragraph on Home | `vendor_tasks.notes` for Golden Hour Photography task `90eff479-…` |

---

## 5. Production vs seed-data determination

| Issue | Determination |
|-------|----------------|
| 1 Complete CTA | **Production code behavior** |
| 2 Final payment / Final Payment | **Production dual-system pattern**; visible on enriched local data; payment half also in stock `seed.sql`; task half from applied Client Planning template |
| 3 Share timeline copy | **Vendor-authored content** on a live `vendor_tasks` row; **not** in stock `seed.sql`; production-possible anytime vendors share tasks with ops-first notes |

**Note:** Stock seed names the venue “Seed Venue”; this QA env is renamed/enriched to Sweet Daisy / applied playbooks / vendor tasks. Portal token matches stock seed token string.

---

## 6. Smallest safe fix for each

1. **Issue 1:** Relabel via `compactNextStepsActionLabel` only (`Open`/`Review` instead of `Complete` for checklist navigation).  
2. **Issue 2:** Prefer unpaid **payment** rows in `buildUnifiedTaskList` over financial playbook checklist mirrors; keep DB rows; do not title-dedupe/delete. (Fixture-only complete/waive is QA-only.)  
3. **Issue 3:** Edit vendor task notes (and template source if desired) for couple-facing hospitality; no Home rewriter; no customer data migration.

---

## 7. Files that would need to change

| Issue | Likely touch list |
|-------|-------------------|
| 1 | `lib/portal/next-steps.ts`, `lib/portal/next-steps.test.ts` |
| 2 | `lib/portal/unified-tasks.ts`, `lib/portal/unified-tasks.test.ts` (± next-steps tests if counts shift); **or** demo data only for QA |
| 3 | Prefer **no code** — vendor task / template content; optional later Home description clamp in `portal-shell.tsx` |

---

## 8. Files / systems that MUST NOT change (surgical guardrails)

| Must not change | Why |
|-----------------|-----|
| Tasks completion APIs / in-place Mark complete behavior (Issue 1) | Would expand Home into workstation or break Spec “navigate only” |
| Payment ledger schema / schedule model / Stripe or mark-paid architecture (Issue 2) | Twin is attention composition, not broken money SoT |
| Delete `event_tasks` / `payment_line_items` rows via migration (Issue 2) | Loses readiness + auto-complete linkage |
| Title-only dedupe without understanding payment vs checklist (Issue 2) | Hides wrong row or leaves Mark-complete-without-pay |
| Bulk rewrite of production `vendor_tasks.notes` (Issue 3) | Customer/vendor-authored content |
| Website, venue dashboard redesigns, unrelated playbook titles (e.g. Submit your timeline) | Out of scope / different SoT |

---

## 9. Regression risks

### Issue 1 (label only)

| Surface | Risk |
|---------|------|
| Couple Home | Low — copy change; navigation unchanged |
| Tasks / Payments / Vendor | None if helper stays Home-only |
| Tests | `next-steps.test.ts` expectation update required |
| Venue / website | None |

### Issue 2 (unified list suppression)

| Surface | Risk |
|---------|------|
| Couple Tasks + Home counts | Attention count drops by 1 when mirror hidden; badge (completable venue/vendor only) may stay at 6 while Home was 10 — already divergent by Part 18.20; re-check counts story |
| Venue readiness / playbook % | **Must keep** `event_tasks` row — only hide from portal attention list |
| Payments | Should become the only couple path for money — good; verify auto-complete still clears checklist on pay |
| Vendor | None |
| Website | None |
| False positive suppression | Over-broad title matching could hide non-payment financial tasks — scope rule carefully (`payment_received` / category financial / explicit Final payment mirror) |

### Issue 3 (content edit)

| Surface | Risk |
|---------|------|
| Couple Home/Tasks | Copy improves if notes edited |
| Vendor workflow | Authors must still control their wording — do not take over via Home |
| Other couples / venues | Untouched if edit is localized to this demo vendor task |
| Venue Submit your timeline | Untouched (separate SoT) |

---

## 10. Recommended implementation order

1. **Issue 1 — Complete → Open/Review** — smallest, Home-only, matches build spec, zero execution risk. Ship first.  
2. **Issue 3 — Share timeline notes (content)** — demo/vendor content hygiene; no architecture risk; immediate hospitality win on Home.  
3. **Issue 2 — Final payment twin** — needs a conscious product rule (“payment path wins in couple attention”). Implement in `buildUnifiedTaskList` with tests; verify pay → auto-complete still clears checklist; re-check Home **10** vs badge **6** storytelling after count changes. Do **not** lead with deletions or schedule redesign.

---

## Appendix — Live inventory used

**Venue `event_tasks` (portal):** 10 total; incomplete completable include Purchase event insurance, Submit your guest count, **Final payment** (`d315e9d6-…`), Submit your timeline, Leave a review.

**Vendor `vendor_tasks` (portal):** incomplete couple-owned includes **Share timeline** (`90eff479-…`) with the investigated notes.

**Payments:** 1 canonical schedule; line items First Installment, Second Installment, **Final Payment** (`dbb97688-…`, due 2026-09-17, pending).

**Home CTA path evidence:** `NextStepsCard` `onNavigate(t.targetSection)` only — no complete fetch on Home.

---

**Stop condition met:** Investigation + this report file only. No application code changes. No database modifications. No migrations. No commits.
