# Couple Home — Final Whole-Page Acceptance Review

**Date:** 2026-08-09  
**Environment:** `http://localhost:3000` · seed portal `/p/seedcoupleportal00000000000000000000000000000001` (Emma & Jordan · Sweet Daisy Barn & Farm)  
**Scope reviewed:** Implementations 1–7 + Payment Obligation Reconciliation (as one Home experience)  
**Specs:** `docs/couple-home-current-state-inventory.md`, `docs/couple-home-architecture-specification.md`, `docs/couple-home-build-specification.md`  
**Method:** Visual/behavioral product acceptance only. Browser MCP could not retain tabs in this session; Playwright Chromium against the live local app was used. Screenshots and machine extracts under `docs/qa/couple-home-final-acceptance/`.  
**Code changes:** None. No Implementation 8. No commit.

---

## 1. Executive verdict

### **READY WITH POLISH**

Couple Home reads as one wedding-planning home: emotionally oriented in the first viewport, clearly hosted by the venue, and structurally honest about what Sweet Daisy still needs—without burying that work under recreation. Payment reconciliation holds on this seed (**$12,960** Home ↔ Payments; installment title duplicates that previously burned the top-5 are gone). Hierarchy, progressive disclosure, Luv, and Memories all land.

Polish remains on count/chrome coherence (banner/Next Steps **10** vs Tasks badge **6**), a few hospitality-tone copy leaks (vendor first-person “Share timeline”), Home row CTA label **Complete** vs build-spec “navigate, no complete-in-place,” and Tasks-side payment/task twinning (**Final payment** + **Final Payment**). None of these defeat the central product question for this review.

**Central question:** Does this feel like the home of someone’s wedding while reliably helping the venue get what it needs?  
**Answer:** **Yes**, with polish—not another structural rebuild.

---

## 2. First viewport assessment

Viewport observed: desktop **1440×900**; mobile **390×844**. Artifact: `01-desktop-home-top.png`, `02-mobile-home-top.png`.

Without scrolling, a couple can understand:

| # | Question | Result | Evidence |
|---|----------|--------|----------|
| 1 | Whose wedding this is | **PASS** | Hero: **Emma & Jordan**; shell couple + venue; title `Emma & Jordan — Sweet Daisy Barn & Farm` |
| 2 | How far away the wedding is | **PASS** | **69 days until your celebration** + date range Oct 17–19, 2026 |
| 3 | Whether they are generally on track | **PASS** | Supportive hero status + need count; Progress **42%** is one scroll below but first viewport already signals “work remains, team with you”—not a crisis dash |
| 4 | Whether their venue needs something | **PASS** | **10 things Sweet Daisy Barn & Farm still needs from you** + banner “waiting on 10 things” |
| 5 | What they should do next | **PASS** | Primary CTA **Review what Sweet Daisy Barn & Farm needs**; Next Steps heading visible in the first desktop fold / immediately under banner |

**First viewport overall:** **PASS** (5/5).

---

## 3. Venue customer assessment

**Question:** If I need something from this couple, is it obvious?

| Check | Result |
|-------|--------|
| Venue-required before recreational | **PASS** — Banner + Next Steps before Working With Your Venue, Progress/Journey, What’s Happening, Your Wedding, Luv, Memories |
| Venue-required actionable | **PASS** — Rows + CTAs; **View all 10 next steps →** lands on Tasks SoT with Mark complete / Pay now |
| Overdue visible without shame | **PASS** — Payments destination marks installments Overdue without “you failed” language; Tasks surfaces First/Second Installment due Apr 20 / Jul 19 with Pay now. No shame hits on Home body text |
| Venue requests not under couple-owned features | **PASS** — P4 never precedes P1 |
| Five-item cap does not hide additional work | **PASS** — Cap honored; **10 left** + **View all 10 next steps →** |
| View-all / full list obvious | **PASS** |
| Tasks remains execution SoT | **PASS** — Full incompletes (payments + venue tasks) on Tasks after View all |

**Venue customer overall:** **PASS**.  
**Note (polish, not venue miss):** Capped Home Next Steps currently leads with venue-task rows; overdue installments appear in Working With Your Venue (Pay Now + “First Installment — due Apr 20”) and fully on Tasks—not invisible.

---

## 4. Couple experience assessment

| Lens | Observation |
|------|-------------|
| Warmth | Wedding photography hero, venue-named support copy, soft Luv/Memories footing |
| Emotional tone | Celebratory countdown + collaborative framing (“team is here with you”) |
| Clarity | Clear names, countdown, need count, primary action |
| Visual hierarchy | Serif names, strong P1 card, quieter P4 bands |
| Amount of information | Summaries + launches; not a second dashboard per feature |
| Amount of work presented | Top 5 of 10 with explicit remainder—manageable |
| Ownership | “Your Wedding” launches; Plans/Story present as couple-owned |
| Excitement | Present in hero + journey + memories; not smothered |
| Support | Team card, Message CTAs, Ask Luv FAB |

**Verdict:** **Balanced** (leans wedding experience; venue-needed work stays impossible to miss).

---

## 5. Hospitality lens assessment

Against “Would a luxury venue host do it this way?”

| Risk | Finding |
|------|---------|
| Corporate | Mild: shell **Export my data**; count language “waiting on 10 things” is operational but hosted |
| CRM | **No** — no pipeline/status tables |
| Task-management app | **Partial** — Next Steps is intentionally task-like (correct for P1); rest of page is not a kanban |
| Demanding | Needs are clear; shame language absent |
| Noisy | Controlled; one Luv line; light activity |
| Unnecessarily technical | Generally clean; **Share timeline** body reads like raw vendor instruction (see §12) |
| Cold | No — photography, warm progress/journey copy, pink Luv accent |

**Hospitality overall:** **PASS with copy polish** on seeded vendor task text.

---

## 6. Progressive disclosure assessment

Home **summarizes and directs**; it does not recreate destination workflows.

| Anti-pattern | Result |
|--------------|--------|
| Second Tasks page | **PASS** — Cap 5 + View all → Tasks workstation |
| Second Payments dashboard | **PASS** — Remaining balance + next payment + Pay Now only |
| Second Guest / Website / Budget dashboards | **PASS** — Launch cards with short status |
| Second Activity center | **PASS** — One “This week” item |

**Duplication observed (destination-level, not Home recreation):** On Tasks, **Final payment** (Mark complete) and **Final Payment** (Pay now) both appear—SoT twinning, not a Home mini-Payments UI.

**Progressive disclosure overall:** **PASS**.

---

## 7. Information hierarchy assessment

Conceptual stack vs shipping order (approved Part 2 order):

| Priority | Concept | Implemented region | Overpowers P1? |
|----------|---------|--------------------|----------------|
| P1 | Venue-required | Banner + Your Next Steps | — |
| P2 | Shared / venue relationship | Working With Your Venue | No |
| P3 | Orientation + activity | Planning Progress, Wedding Journey, What’s Happening | No |
| P4 | Couple-owned planning | Your Wedding | No |
| P5 | Delight / engagement | Luv, Memories | No |

Observed document order: Hero → Banner → Next Steps → Working With Your Venue → Progress ∥ Journey → What’s Happening → Your Wedding → Luv → Memories.

**Information hierarchy overall:** **PASS**.

---

## 8. Luv assessment

| Check | Result |
|-------|--------|
| Suggestions-first | **PASS** — Home: “You completed 2 planning items this week — lovely momentum.” |
| Does not duplicate venue-required work | **PASS** — No “complete insurance / pay now” in Luv card |
| No autonomous actions | **PASS** — Observational card; FAB opens Ask Luv Q&A |
| Does not compete with Next Steps | **PASS** — After Your Wedding; FAB does not cover P1 at rest |
| Helpful vs intrusive | **PASS** — Quiet pink strip; FAB opt-in |

Artifact: `01-desktop-luv.png`, `07-luv-fab-open.png`.

**Luv overall:** **PASS**.

---

## 9. Memories assessment

| Check | Result |
|-------|--------|
| Emotional, not operational | **PASS** — “A moment from your journey” + engagement photo teaser |
| Not task-like | **PASS** — No Complete/Required |
| Does not compete with venue work | **PASS** |
| Remains at bottom | **PASS** — After Luv |

Artifact: `01-desktop-memories.png`, `02-mobile-memories.png`.

**Memories overall:** **PASS**.

---

## 10. Desktop assessment (~1440px)

| Check | Result |
|-------|--------|
| First viewport hierarchy | **PASS** |
| Section rhythm | **PASS** — Clear bands; Progress ∥ Journey side-by-side |
| Column relationships | **PASS** — Working With Your Venue team \| payments+timeline |
| Card density | **PASS** — Not cramped |
| Whitespace | **PASS** — Editorial, not sparse-broken |
| Visual balance | **PASS** |
| Duplicate content | **PASS on Home** — No repeated installment rows in top 5 (reconcile held). Tasks twin Final payment noted in §13 |
| Excessive scroll before important actions | **PASS** — P1 in first fold / immediately under hero |

Artifacts: `01-desktop-home-top.png`, `01-desktop-home-full.png`, section crops.

**Desktop overall:** **PASS**.

---

## 11. Mobile assessment (~390×844)

| Check | Result |
|-------|--------|
| First viewport hierarchy | **PASS** — Names, countdown, 10 things, stacked CTAs |
| Venue-required visibility | **PASS** — Banner + Next Steps under hero |
| CTA usability | **PASS** — Hero primary ~36–38px tall |
| Horizontal overflow | **PASS** — `scrollWidth === clientWidth` (nav may scroll horizontally by design) |
| Excessive card height | **PASS** — Rows readable |
| Awkward whitespace | **PASS** for main stack |
| Disproportionate section | **PASS** — Hero assertive but not burying P1 |
| Luv FAB obscuring important actions | **PASS** at rest — bottom-right; Next Steps above |

Minor: sticky header remains a bit tight (venue + Export). Not acceptance-blocking.

Artifacts: `02-mobile-home-top.png`, `02-mobile-home-full.png`, `02-mobile-next-steps.png`, section crops.

**Mobile overall:** **PASS with minor chrome polish**.

---

## 12. Copy concerns

Do not rewrite here—list failures against hospitality lens.

| Exact wording (current) | Why it fails |
|-------------------------|--------------|
| “Please ensure the times of the different aspects of the event that impact my participation is supplied 2 weeks before the event, so I know when to be where.” (**Share timeline** row) | First-person vendor/ops voice on the couple home; grammar (“aspects … is”); feels pasted from vendor instructions, not hosted venue→couple language |
| Shell chrome: “Export my data” | Correct for privacy tooling, but reads bureaucratic next to celebration hero (minor) |
| Tasks destination framing: “newest due date first” (while list leads with overdue Apr/Jul payments) | Unclear / inconsistent with observed ordering (destination copy; couples reach it from Home View all) |
| Payments helper: “Your next payment, Final Payment, is scheduled for September 17.” while First Installment is overdue | Confusing “next” when earlier installments unpaid (Payments destination; Trust-adjacent) |

No shame-based Home copy found (“You have overdue tasks”, etc.).

---

## 13. Trust / consistency assessment

| Check | Result | Notes |
|-------|--------|-------|
| Payment totals consistent | **PASS** | Home Working With Your Venue **$12,960 remaining**; Payments **$12,960** total/remaining; **no $38,880** |
| Task counts as documented | **PASS with polish** | Banner / Next Steps **10**; Tasks badge **6** — aligns with build Part 18.20 (badge = completable venue/vendor chrome; Home = unified incomplete). Still feels split to a couple |
| Progress does not contradict Home | **PASS** | Single operational **42%**; Payments **0/3** matches unpaid schedule; Journey emotional only |
| Activity does not invent events | **PASS** | “You added an engagement photo” / Memories photo present |
| Luv does not claim actions it can’t take | **PASS** | Momentum observation; Ask Luv is Q&A |
| Destination links work | **PASS** | View all → Tasks; View Timeline → timeline; Message → messages; Payments nav → payments schedule |
| Stale/demo copy | **PASS** on Home chrome | No lorem/TODO. Seeded vendor text on Share timeline is the main naturalness miss |
| Runtime overlay blocking UI | **PASS (non-blocking)** | `nextjs-portal` node exists empty; no Unhandled Runtime Error dialog in screenshots |

**Trust overall:** **PASS with important polish** on badge vs 10 and Tasks Final payment twinning.

---

## 14. Specific defects

### BLOCKERS

*None observed that prevent accepting Couple Home as a shipping whole-page experience on this seed.*

(Empty Next.js portal shell alone is **not** a user-facing blocker in this run.)

### IMPORTANT POLISH

1. **Banner / “10 left” vs Tasks badge 6** — Couples may think Home and Tasks disagree. Confirm Part 18.20 intent; if intentional, consider quieter clarification later—not a redesign.  
2. **Home Next Steps row CTA labeled “Complete”** — Reads as complete-in-place; build spec prefers navigate-to-Tasks without in-place completion. Relabel / route consistency (do not expand Home into Tasks workstation).  
3. **Tasks: Final payment (Mark complete) + Final Payment (Pay now)** — Same obligation feeling twice. Prefer one clear payment path.  
4. **Share timeline** vendor first-person body (exact text in §12) — Content hygiene from seed/task description.  
5. **Overdue installments not in Home top-5** while Apr 20 / Jul 19 are overdue — Mitigated by Payments card + View all; still a mild attention-order polish after grouping “FROM YOUR VENUE” first.

### OPTIONAL POLISH

1. Mobile header crowding (venue + Export).  
2. Wedding Journey “1 mo You’re here” beside **69 days** countdown — emotional strip vs operational clock (live milestone fidelity is partly deferred).  
3. Soften or relocate “Export my data” on celebratory surfaces.  
4. Tasks copy “newest due date first” vs overdue-first behavior.  
5. Payments “next payment = Final Payment” helper while earlier installments overdue.

### KNOWN DEFERRED ITEMS (do not penalize)

- Last-visit activity intelligence  
- Venue/vendor activity types not yet emitted by activity SoT  
- Live Wedding Journey milestone data beyond existing date-based behavior  
- New activity destination  
- New recommendation algorithms  
- Registry / Inspiration destinations that do not currently exist  

---

## 15. Specific polish recommendations

Ordered for impact vs risk; **not** an Implementation 8 work package and **not** auto-assigned engineering tasks.

1. Align couple-facing count storytelling for **10** vs badge **6** (copy or chrome clarity—keep SoT rules).  
2. Make Next Steps row actions obviously “open in Tasks / Pay” rather than “Complete” if completion must stay on Tasks.  
3. Dedupe or clearly differentiate Final payment task vs Final Payment schedule item once in Tasks SoT.  
4. Host-edit or template **Share timeline** body into couple-facing venue voice.  
5. Optionally ensure at least one overdue shared payment can appear inside the Home top-5 when present (without bringing duplicates back).  
6. Leave Luv / Memories / Your Wedding structure alone—they already pass whole-page hospitality tests.

---

## Appendix — Evidence index

| Artifact | Use |
|----------|-----|
| `docs/qa/couple-home-final-acceptance/01-desktop-home-top.png` | First Impression / desktop first fold |
| `docs/qa/couple-home-final-acceptance/01-desktop-home-full.png` | Full desktop stack |
| `docs/qa/couple-home-final-acceptance/01-desktop-next-steps.png` | P1 rows + View all |
| `docs/qa/couple-home-final-acceptance/01-desktop-working.png` | Venue team / payments / timeline |
| `docs/qa/couple-home-final-acceptance/01-desktop-progress.png` | Progress ∥ Journey |
| `docs/qa/couple-home-final-acceptance/01-desktop-your-wedding.png` | P4 launches |
| `docs/qa/couple-home-final-acceptance/01-desktop-luv.png` / `01-desktop-memories.png` | P5 |
| `docs/qa/couple-home-final-acceptance/02-mobile-home-top.png` / `02-mobile-home-full.png` | Mobile hierarchy |
| `docs/qa/couple-home-final-acceptance/03-tasks-via-view-all.png` | Tasks SoT after View all |
| `docs/qa/couple-home-final-acceptance/04-payments.png` | Payment total consistency |
| `docs/qa/couple-home-final-acceptance/05-timeline.png` / `06-messages.png` | Destination links |
| `docs/qa/couple-home-final-acceptance/07-luv-fab-open.png` | Ask Luv panel |
| `docs/qa/couple-home-final-acceptance/qa-results.json` (+ `-2`, `-3`) | Extracted counts / order / trust probes |

---

**Stop condition met:** Documentation only. No code modifications. No Implementation 8. No commit.
