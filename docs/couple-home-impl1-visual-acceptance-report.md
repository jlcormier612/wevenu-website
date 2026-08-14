# Couple Home – Implementation 1 – Visual Acceptance Report

**Date:** 2026-08-08  
**Environment:** `http://localhost:3000` · couple `emma.carter@example.com` → `/p/seedcoupleportal00000000000000000000000000000001`  
**Specs:** `docs/couple-home-current-state-inventory.md`, `docs/couple-home-architecture-specification.md`, `docs/couple-home-build-specification.md`  
**Method:** Visual/behavioral QA only. Browser MCP (`cursor-ide-browser`) could not retain tabs in this agent session; Playwright headless Chromium was used against the same local app. Screenshots under `docs/qa/couple-home-impl1/`.  
**Code changes:** None.

---

## 1. Desktop result

**Verdict: PASS with defects (layout/hierarchy largely meets Impl 1; data/UX issues noted below).**

| Check | Result |
|-------|--------|
| Hero hierarchy (venue eyebrow → couple names → countdown → status → support → primary + ≤2 secondary CTAs) | **PASS** — Sweet Daisy eyebrow; Emma & Jordan; 70 days; “16 things…still needs”; venue-team support line; primary “Review what … needs”; secondary Message / View Timeline. No snapshot metrics grid. |
| Wedding Snapshot readability | **PASS** — text over darkened hero gradient remains readable. |
| Your Next Steps prominence | **PASS** — directly under Venue Requests banner; strong card treatment; eyebrow “What [Venue] needs from you”; “Open all tasks”. |
| Venue-required / P1 before lower-priority work | **PASS** — P1 stack above Working With Your Venue, Progress/Journey, What’s Happening, Your Wedding, Luv, Memories. |
| Venue Requests Banner | **PASS** — “Sweet Daisy… waiting on 16 things…” + “Jump to your next steps below.”; click scrolls/focuses `#your-next-steps`. Omit-when-0 not testable on this account (always N>0). |
| Working With Your Venue grouping | **PASS** — section label; 2-col team \| payments+timeline; Guide/Vendors text links. |
| Planning Progress + Wedding Journey | **PASS** — side-by-side on `lg`; single operational % (28%); Journey emotional strip only. |
| What’s Happening | **PASS** — activity present (“This week” engagement photo items). |
| Your Wedding | **PASS** — launch grid with status (Website 100%, Guests, Budget, Seating, Plans “1 on your list”, Story). |
| P4 (Luv, Memories) | **PASS** — after Your Wedding; Luv observational; Memories strip (“A moment from your journey”). |
| Vertical rhythm / duplicates / overflow | **PARTIAL** — rhythm and no horizontal overflow OK; **duplicate Next Steps rows** (First/Second Installment ×2) — see §6. |
| Navigation chrome | **PASS** — Home/Tasks/etc. reachable; Tasks badge “6”; Ask Luv FAB present and not covering P1 CTAs in resting scroll. |

**Observed desktop reading order:** Hero → Venue Requests Banner → Your Next Steps → Working With Your Venue → Planning Progress ∥ Wedding Journey → What’s Happening → Your Wedding → Luv → Memories. Matches Part 2 / Part 14 (desktop refinement for Progress∥Journey allowed).

---

## 2. Mobile result

**Verdict: PASS with minor defects (hierarchy correct; some chrome crowding).**

Viewport used: **390×844** (iPhone-class).

| Check | Result |
|-------|--------|
| Hero understandable | **PASS** — names, countdown, status, CTAs stack readably. |
| Venue-required above P4 | **PASS** — Progress then Journey (single column); Your Wedding then Luv then Memories. |
| Next Steps readable | **PASS** — cards scannable; ownership + overdue copy visible. |
| Buttons usable | **PASS** — hero CTAs / Open all tasks / FAB ≥ ~36px height. |
| Cards excessively tall | **PASS** — Next Steps rows reasonable; hero shorter than desktop OK. |
| Horizontal scroll | **PASS** on document (`scrollWidth === clientWidth`). Nav tabs intentionally scroll horizontally. Some absolute children report `right > viewport` (FAB/chrome); no body overflow-x. |
| Clipped / wrapping | **MINOR** — mobile header crowded (venue name + “Export my data” tight); no critical body truncation measured on “16 left…” counter. |
| Desktop-only bleed | **PASS** — Progress/Journey stack (not side-by-side). |
| P1 not below recreational | **PASS**. |

---

## 3. Functional result

Account: Emma & Jordan / Sweet Daisy. **DB not modified.** States below are what this seed/relationship affords.

| # | State | Result |
|---|--------|--------|
| 1 | Venue-required task exists | **PASS (via Tasks SoT)** — e.g. “Purchase event insurance”, “Submit your guest count”, “Submit your timeline” with Mark complete. **Not in Home’s capped top-5** (overdue payments occupy the 5 slots). Count “16 left” implies they are in the unified list. |
| 2 | Multiple venue-required tasks | **PASS** on Tasks destination. |
| 3 | Venue-required overdue | **PASS (Shared planning payments)** — Apr 20 / May 25 / Jul 19 items show overdue treatment (“…is waiting on this” + “Needed by …”). No shame copy (“You have overdue tasks”). |
| 4 | Vendor task exists | **Could not clearly reproduce** as a distinct vendor-owned row on Emma’s visible Tasks/Home samples (may be absent in seed or not `canComplete`). |
| 5 | Couple-created personal todo | **PASS** — Your Wedding → Plans “1 on your list”; **not** labeled into Your Next Steps (“For your wedding” absent from Next Steps). |
| 6 | No venue-required / P1 clear | **Could not reproduce** without another relationship or resolving all P1 (DB mods forbidden). Emma always had N=16. |
| 7 | No activity | **Could not reproduce** — activity present. Empty copy path exists in code as quiet-week variant (“Nothing new this week…”), aligned with architecture; build prefers last-visit wording (Impl 1 explicitly deferred last-visit intelligence). |
| 8 | Payment exists | **PASS** — Next Steps Shared planning payments; Payments destination shows schedule + Pay now; Working With Your Venue Payments card. |
| 9 | Timeline unpublished changes | **PASS on Tasks** — “Submit your timeline” present. Not in Home’s visible top 5 (cap/order); included in attention count. |
| 10 | View-only relationship | **Could not reproduce** without alternate account / DB. |

**Priority hierarchy vs build spec:** P1 (banner + Next Steps) → P2 (Working With Your Venue) → Progress/Journey/Activity → P3 (Your Wedding) → P4 (Luv/Memories). Overdue shared payments correctly outrank later-dated venue tasks in the capped list. Personal todos do not enter Next Steps.

---

## 4. Tasks regression result

**Verdict: No Home-introduced Tasks regression identified; pre-existing/synthesis duplication surfaces on Tasks identically.**

| Check | Result |
|-------|--------|
| Display | **PASS** — list renders; “From your venue” framing; payment + venue tasks. |
| Ordering | **PASS-ish** — past-due payment items appear first; then sooner dues. Copy still says “newest due date first” which is **stale vs overdue-first behavior** (copy defect on Tasks, document only). |
| Completion controls | **PASS** — Mark complete / Pay now present (observe-only; no completions performed). |
| Ownership / permissions | **PASS** — completable venue items and payment CTAs available for this full-access couple. |
| Dates | **PASS** — due dates shown. |
| Navigation from Home | **PASS** — “Open all tasks” and banner→Next Steps→tasks navigation work. |
| Duplicates | **FAIL (data/SoT)** — First Installment ×2, Second Installment ×2 also on Tasks (same as Home). Not a Home-only visual bug; shared `buildUnifiedTaskList` / multiple payment schedules in seed (Payments page shows one $12,960 schedule; Home balance $38,880 ≈ 3×). |

**No Tasks code changes made** (document-only per pass rules).

---

## 5. Specification deviations

| Spec expectation | Actual | Severity |
|------------------|--------|----------|
| At most 5 Next Steps rows, unique actionable items preferred | Cap of 5 honored, but **duplicate titles** consume 2 of 5 slots | Medium (UX / synthesis) |
| Due copy: `Due Mar 12` / today / tomorrow | Overdue uses **`Needed by Apr 20`** (plus waiting copy) | Low (intentional softening; still plain-language) |
| Banner N = unified incomplete P1 count; Tasks badge = completable venue/vendor chrome | Banner **16** vs badge **6** | Low–Medium (can confuse; may be intentional per Part 18.20) |
| Single Home operational % | Planning Progress **28%** only as readiness module; other % are Payments plan / Website launch status | Pass |
| What’s Happening empty: last-visit calm copy | Quiet-week variant in code; Emma had activity | Informational (Impl 1 deferred last-visit) |
| Payments destination vs Home Remaining | Payments schedule **$12,960**; Home card **$38,880**; Progress **Payments 0/9** | Medium (data inconsistency / seed duplicates) |
| `Final Payment` May 25 on Home/Tasks vs Sep 17 on Payments schedule UI | Conflicting due dates across surfaces | Medium (seed / multi-schedule) |

No section-order defects against Part 2/14. No P4-above-P1 burial. No complete-in-place on Home.

---

## 6. Visual defects

### VD-1 — Duplicate Next Steps / Tasks payment rows
- **Exact page/section:** Couple Home → Your Next Steps; also Tasks list.
- **What is wrong:** First Installment and Second Installment each appear twice with identical copy/dates.
- **Expected:** One row per obligation (or clear differentiation if truly distinct schedules).
- **Actual:** Duplicate cards burn capped P1 slots and inflate “16 left”.
- **Suggested minimal fix:** Dedupe payment line items in `buildUnifiedTaskList` (or fix seed schedules). Prefer SoT fix once—not a Home-only redesign. **Do not redesign Home card UI.**

### VD-2 — Banner count vs Tasks badge mismatch
- **Exact page/section:** Home banner + shell Tasks badge.
- **What is wrong:** “waiting on **16**” beside Tasks badge **6**.
- **Expected:** Counts feel coherent, or chrome/badge meaning is obvious.
- **Actual:** Couples may think Home and Tasks disagree.
- **Suggested minimal fix:** Confirm intentional (Part 18.20); if yes, optional quiet helper copy later—not required for Impl 1 close. If unintentional, align badge computation with unified incomplete set carefully.

### VD-3 — Mobile header crowding
- **Exact page/section:** Portal sticky header on ~390px.
- **What is wrong:** Venue name and “Export my data” sit tightly; feels cramped.
- **Expected:** Clear, uncrowded chrome without wrapping into illegibility.
- **Actual:** Workable but tight; nav tabs scroll horizontally (OK).
- **Suggested minimal fix:** Soften Export placement / truncate venue under couple name on xs—polish; **not an Impl 1 blocker**.

### VD-4 — Payments remaining balance inconsistency across surfaces
- **Exact page/section:** Home Working With Your Venue → Payments card vs Payments destination.
- **What is wrong:** Home shows **$38,880** remaining; Payments schedule shows **$12,960** total remaining.
- **Expected:** Same financial truth.
- **Actual:** ~3× schedule duplication leaked into Home summary math.
- **Suggested minimal fix:** Same as VD-1 (schedule seed / aggregation). Document rather than redesign Payments card.

### VD-5 — Capped Next Steps over-indexes payments vs venue tasks
- **Exact page/section:** Your Next Steps (top 5).
- **What is wrong:** All 5 visible rows are Shared planning payments (with duplicates); no “From your venue” label visible until Tasks.
- **Expected:** Correct overdue-first ordering still should surface distinct venue-required work when many P1 exist—or duplicates shouldn’t starve variety.
- **Actual:** Spec ordering followed; duplicates exacerbate starvation.
- **Suggested minimal fix:** Fix duplicates (VD-1); no reorder redesign.

---

## 7. Recommended fixes

**Priority order (for a later fix pass—not started here):**

1. **Investigate & remove duplicate payment schedules / line items** in seed or unify/dedupe in `buildUnifiedTaskList` so Home Next Steps and Tasks stop showing twin rows (VD-1/VD-4).  
2. **Reconcile attention count messaging** vs Tasks badge if product wants less confusion (VD-2)—docs-first decision.  
3. **Optional mobile header tweak** for Export / venue label (VD-3)—polish only.  
4. Defer view-only, empty-P1, empty-activity, and vendor-task coverage to a targeted state matrix with non-Emma portals or controlled fixtures (**no DB edits in this pass**).  
5. **Do not begin Implementation 2** (last-visit activity intelligence, new Journey milestones, etc.).

---

## 8. Screenshots

| Path | Caption |
|------|---------|
| `docs/qa/couple-home-impl1/01-desktop-home-top.png` | Desktop hero + banner + Next Steps header |
| `docs/qa/couple-home-impl1/02-desktop-home-full.png` | Desktop top stack (main is inner-scroll; use section shots below) |
| `docs/qa/couple-home-impl1/14-desktop-next-steps.png` | Next Steps with duplicate installment rows + Working With Your Venue start |
| `docs/qa/couple-home-impl1/15-desktop-working.png` | Working With Your Venue (team \| payments/timeline) + Progress/Journey |
| `docs/qa/couple-home-impl1/16-desktop-progress.png` | Progress/Journey, What’s Happening, Your Wedding, Luv, Memories |
| `docs/qa/couple-home-impl1/06-mobile-home-top.png` | Mobile hero + banner |
| `docs/qa/couple-home-impl1/25-mobile-next-steps.png` | Mobile Next Steps duplicates |
| `docs/qa/couple-home-impl1/29-mobile-luv-memories.png` | Mobile Your Wedding + P4 Luv/Memories below P3 |
| `docs/qa/couple-home-impl1/21-tasks-after-open-all.png` | Tasks after Open all tasks |
| `docs/qa/couple-home-impl1/22-payments-nav.png` | Payments destination (single $12,960 schedule) |
| `docs/qa/couple-home-impl1/qa-results.json` / `qa-results-2.json` | Machine capture notes |

Additional captures: `03–05`, `07–13`, `17–20`, `23–24`, `26–28`, `30-*` in the same folder.

---

## Overall Impl 1 visual acceptance

**Conditional PASS** for Implementation 1 composition and priority hierarchy on desktop and mobile.

**Blockers for a clean visual sign-off:** none that are pure layout/section-order defects.  
**Must-track before calling the experience “tidy”:** VD-1 / VD-4 duplicate payment synthesis (appears as unexpected duplicate cards and conflicting money totals).

**STOP:** Implementation 2 not started. No architecture, API, DB, or product-feature changes made.
