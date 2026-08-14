# Couple Home — Phase 2 Architecture Specification

Specification date: 2026-08-08  
Canonical Home: `/p/{accessToken}` with default section `overview` (`#overview`)  
Source of current-state fact: `docs/couple-home-current-state-inventory.md` (Phase 1)  
Scope: Architecture decisions for Couple Home only. No implementation in this phase.

---

## Critical action hierarchy (applies to all sections below)

| Priority | Class | Meaning on Home |
|----------|--------|-----------------|
| **1** | Venue-required actions | Items the venue needs from the couple to progress the booking (tasks, requests, unsigned contracts, unpaid obligations, sent questionnaires, final-stretch / wedding-day required work). |
| **2** | Shared planning actions | Collaboration surfaces where venue and couple both participate (timeline previews, payments status entry, messages / team contact, seating as shared floor-plan work, documents surfaced only as required-action pointers). |
| **3** | Couple-created planning actions | Couple-owned planning they initiate (website, guests, budget, personal plans/todos, story writing entry). |
| **4** | Engagement, inspiration, memories, and delight | Luv observational coaching, seasonal/coming-up inspiration, memory/journal teasers, celebration milestones, keepsake emotional framing (when date-mode allows). |

**How the hierarchy shapes the experience**

| Concern | Rule |
|---------|------|
| **Ordering** | Higher priority sections and items appear earlier in the primary vertical flow (and earlier within a section). Priority 4 never precedes unresolved Priority 1 content in the default pre-wedding Home stack. |
| **Visual prominence** | Priority 1 uses the strongest “needs attention” treatment: clear venue-need framing, primary CTAs, and attention styling when actionable items exist. Priority 2 is operationally clear but quieter. Priority 3 is inviting and warm. Priority 4 is quiet and optional. |
| **Badges** | Unread / incomplete counts that represent venue-required or attention-needed shared work outrank delight badges. Nav Tasks badge remains the chrome signal for incomplete venue/vendor completable work (Phase 1). Home-local badges for Priority 4 are discouraged. |
| **CTAs** | When Priority 1 items exist, the first primary CTA in the attention region is complete/resume venue-needed work—not inspiration or personal planning. Secondary CTAs may point to Messages, Payments, or Timeline. Couple-planning CTAs live in the couple-planning region. |
| **Overdue treatment** | Overdue Priority 1 items use warm, venue-collaborative urgency (“Your venue needs this from you”)—not corporate shame (“You have overdue tasks”). Overdue shared payment obligations follow the same humane tone. Couple personal todos overdue do not visually outrank venue-required overdue items. |
| **Empty states** | Empty Priority 1 celebrates calm (“You’re all caught up with what [Venue] needs”) and may gently surface Priority 2–4. Empty Priority 3 invites delightful starts without manufacturing fake urgency. Empty Priority 4 simply omits or uses a soft invite—never competing with venue needs. |
| **Mobile ordering** | Strict top-to-bottom priority: attention / venue needs → shared collaboration summaries → couple planning launches → activity / progress narrative → inspiration & Luv → memory. Collapse or defer lower-priority cards first under viewport pressure. |

**Tone for venue-required**

- Use: “Your venue needs this from you,” “Something [Venue] is waiting on,” “Finish what helps your day come together.”
- Avoid: “You have overdue tasks,” harsh corporate compliance language, guilt framing, or treating personal todos as if they were venue mandates.

---

## 1. Purpose of Home

Home is the couple’s **wedding-planning home**—a calm, exciting control surface that answers five questions at a glance:

1. How are we doing?
2. What does the venue need from us?
3. What needs our attention next?
4. What’s changed?
5. What can we work on or enjoy?

Home is **not**:

- A feature directory or app launcher competing with the full nav
- A collection of duplicated mini-dashboards that recreate Tasks, Payments, Timeline, Guests, Website, etc.
- Venue staff software wearing wedding language

Home **summarizes and directs** into destination sections that remain the single sources of truth for detailed workflows. It makes venue collaboration visible, keeps couple-owned planning prominent and enjoyable, and keeps Luv suggestions-first and observational. Visual language remains Hello to Cheers: premium, editorial, warm, quiet, minimal, sophisticated, hospitality-first.

---

## 2. Primary user goal

When a couple opens Home, they should immediately feel:

- Excited about their wedding and in control of planning
- Clear on what their venue still needs from them
- Confident about what to do next (without hunting across duplicated dashboards)
- Oriented to progress, recent change, and optional joyful planning—without those competing with venue-required work

Success is measured by: venue actions impossible to miss and easy to complete; personal planning easy to enter; no confusion about where “truth” lives.

---

## 3. Venue business goal

Home should maximize:

- Completeness and timeliness of **venue-required client actions** (tasks, requests, contracts, payments, questionnaire, final details)
- Couple engagement that keeps them returning (planning tools, story, inspiration, Luv) **without** burying operational needs
- Clear collaboration identity: the couple feels hosted by *their* venue, not by generic software

Venue-required actions always outrank couple personal tasks for operational priority on Home.

---

## 4. Home information hierarchy

Top-to-bottom conceptual stack (pre-wedding default; date-mode bands adjust emphasis per §15–§16 and §20–§22):

1. **Identity & welcome** — who we are, which venue, when the day is (atmosphere without replacing attention)
2. **Attention & venue needs** — Priority 1 (and Priority 2 items that are currently blocking)
3. **Shared collaboration pulse** — team, messages entry, payments status pointer, timeline peek (summaries only)
4. **How we’re doing** — wedding progress / journey narrative (summary, not duplicate workflows)
5. **What’s changed** — recent activity / attention deltas (observational)
6. **Couple planning** — launches into couple-owned destinations (status presence only)
7. **Enjoy & explore** — Luv observational card, inspiration, memory teaser (Priority 4)
8. **Date-mode overlays** — Final stretch / wedding day / just married / keepsake bands when `daysUntil` thresholds apply (Phase 1 brackets preserved as mode triggers; composition rules clarified in §16)

Legal Welcome gate remains a hard pre-Home gate (Phase 1).

Chrome (header, nav, footer, Ask Luv FAB, notification bell) sits outside the overview composition but must not contradict the hierarchy (e.g. Tasks badge remains a Priority-1-aligned signal).

---

## 5. Proposed section order

Recommended order inside `OverviewSection` (name labels are architectural, not final UI copy):

| Order | Section | Priority class |
|-------|---------|----------------|
| 0 | Legal gate (if applicable) — blocks all below | system |
| 1 | **Welcome / hero** (identity, countdown, restrained CTAs) | identity + directs by hierarchy |
| 2 | **Needs your attention** (venue-required Next Steps + request attention; primary venue-need framing) | P1 |
| 3 | **With your venue** (team, messages entry, payments status summary, timeline peek) | P2 |
| 4 | **How you’re doing** (single progress / journey summary — one story, not three %) | mixed summary |
| 5 | **What’s new** (activity / change digest) | observational |
| 6 | **Your planning** (couple launch grid: Website, Guests, Budget, Seating, Plans, Our Story) | P3 |
| 7 | **Enjoy & remember** (Luv observational card, inspiration, memory strip; one-time Luv intro when unseen) | P4 |
| 8 | **Date-mode band** when applicable (Final Details / Wedding Day / Just Married / Keepsake) — placed to preserve P1 prominence within the mode (see §16) | mode-specific |

**Mobile:** same order; multi-column pool is replaced by single-column priority order (§23).  
**Desktop:** same logical order; shared-collaboration and progress may sit in a calmer secondary column only if P1 remains first in reading order (§24).

Chrome (sticky header, `NAV_ITEMS`, footer, Floating Ask Luv) remains shell-level per Phase 1—not reinvented as Home content.

---

## 6. Purpose of every proposed section

| Section | Purpose |
|---------|---------|
| **Welcome / hero** | Orient emotionally and temporally: couple names, venue, countdown, reassurance. CTAs follow hierarchy (venue needs first when present). Not a second dashboard. |
| **Needs your attention** | Make venue-required work impossible to miss: unified incomplete items + request attention, with clear path into Tasks (SoT). Tone: venue needs this from you. |
| **With your venue** | Show collaboration: who’s on your team, how to message, money status pointer, next timeline moments—summaries directing to Messages / Payments / Timeline. |
| **How you’re doing** | One coherent answer to wedding/venue readiness progress—not multiple competing percentage widgets. |
| **What’s new** | Answer “what’s changed?” with a lightweight activity digest that directs into the right destination when actionable. |
| **Your planning** | Prominent, enjoyable entry to couple-owned planning destinations; status lines only; editing lives on destination pages. |
| **Enjoy & remember** | Priority-4 delight: observational Luv, optional inspiration, journal memory teaser—never competing with unresolved venue needs. |
| **Date-mode band** | Contextual urgency or celebration (final stretch, wedding day, post-wedding keepsake) without silently claiming to “replace” the whole Home when Phase 1 still shows venue/wedding blocks. |

---

## 7. Which current Home elements remain

Retain on Home (possibly under renamed section groupings; Phase 1 component identities preserved as reuse candidates):

| Element (Phase 1) | Remain as |
|-------------------|-----------|
| Hero identity (backdrop, venue eyebrow, welcome, names, countdown, date) | Welcome / hero |
| Next Steps incomplete list + Open Tasks + readiness concept (see §15 for % consolidation) | Needs your attention |
| Requests attention signal (when actionable) | Needs your attention (merge with attention, not a third competing card) |
| VenueTeamCard (roster + Message / mailto) | With your venue |
| PaymentsCard condensed status | With your venue |
| TimelineCard peek (next timed entries) | With your venue |
| Your Wedding launch cards (Website, Guests, Budget, Seating, Plans, Story) | Your planning |
| MemoryStrip teaser → Story | Enjoy & remember |
| LuvDailyCard (observational, single message) | Enjoy & remember |
| LuvIntroCard (one-time) | Enjoy & remember / first-run |
| FloatingLuvWidget + Ask Luv | Shell (unchanged role) |
| CoupleNotificationBell | Shell |
| Date-mode: Final Details checklist emphasis, Wedding Day Portal, Just Married, Keepsake flows | Date-mode band |
| Planning / journey narrative **as one consolidated concept** | How you’re doing (see §8–§9 for current duplicates) |
| Key Dates (venue calendar next dates) | With your venue or What’s new—summarized next date only |
| Legal Welcome gate | Pre-Home |

---

## 8. Which current Home elements move

“Move” means **architectural relocation within Home or promotion into shell / destination behavior**—not file renames in this phase.

| Element | Move to |
|---------|---------|
| Hero primary CTA stack (Continue Your Journey / Review Tasks / Message / Timeline as equal peers) | Hierarchy-driven CTA set on hero: P1 first when applicable; couple journey CTA secondary |
| RequestsSummaryCard as separate multi-column card | Into **Needs your attention** (single attention region) |
| WeddingPlanningProgressCard, PlanningJourney dots, Snapshot readiness cells, Next Steps readiness bar as separate % stories | Collapse into **How you’re doing** (one progress narrative; see §15) |
| Coming Up + Seasonal Inspiration as peer cards in the pool | Into **Enjoy & remember** (inspiration subsection), below couple planning; suggestions remain optional |
| VenueNoteCard (hard-coded venue voice) | Out of default Home prominence until venue-authored content exists (see §9 / §32); optional later under With your venue |
| WeddingJourneySection hard-coded celebration milestones | Into **How you’re doing** / journey narrative only when milestones are live-wired; stub milestones do not ship as false incompletes |
| Multi-column CSS pool ordering | Replaced by intentional priority order (§5); no “balanced column” as prioritization strategy |
| Date-mode sections currently stacked after Your Wedding while comments say “replaces” | Clarify product truth: **band emphasizes**, does not claim full replacement while venue/attention remain (align comments/impl in implementation phase; Open Q1) |

---

## 9. Which current Home elements are removed from Home because they duplicate destination experiences

Remove from Home composition (destination remains SoT; Home must not recreate):

| Element | Why remove from Home | Destination SoT |
|---------|----------------------|-----------------|
| **WeddingSnapshotCard** metrics grid | Duplicates countdown, guests, todos, readiness already told by hero + launches + progress | Guests / Plans / Tasks as appropriate |
| **Full Next Steps as a task workstation** (if expanded beyond summary) | Tasks section owns completion UX; Home keeps title/summary + Open Tasks only | `tasks` / `UnifiedTasksSection` |
| **Requests as a second full summary competing with Next Steps** | Same attention story; merge into attention region | Tasks (Phase 1 already navigates summary → `tasks`; Requests section routing remains open Q) |
| **Multiple readiness % widgets** (Next Steps bar + Wedding Planning Progress + Snapshot venue %) | Duplicate sources of “how we’re doing” with different formulas | One Home progress story; details on destination sections |
| **WeddingJourneySection milestones when website/invitations hard-coded false** | False incompletes duplicate Guests/Website status badly | Website / Guests live status only |
| **VenueNoteCard hard-coded quote** | Pretends venue authorship; duplicates hero reassurance tone without SoT | Venue Guide / future venue-authored note if built |
| **Seasonal / Coming Up tip banks as primary “work” lists** | Compete with venue-required work; duplicate Plans suggestion patterns | Soft inspiration only under P4; deep work in `todos` |
| **Inline wedding-day full run-of-show workstation** beyond a mode-appropriate summary | Timeline / run-of-show detail belongs on Timeline / wedding-day destination surfaces | `timeline` / WeddingDayPortal scoped carefully |
| **Complete-in-place task checklists on Home** (Final Details currently display-only—keep non-completing summary; do not grow into full Tasks UI) | Avoid second task SoT | `tasks` |

Home may still **point** at these destinations with one-line status; it must not re-host their workflows.

---

## 10. Which new Home elements are required

| New element | Why required |
|-------------|--------------|
| **Unified “Needs your attention” region** | Enforce P1 framing and merge Next Steps + request attention into one impossible-to-miss block |
| **Hierarchy-aware hero CTA policy** | Prevent equal-weight CTAs from competing with venue needs |
| **Single “How you’re doing” progress/journey module** | End duplicate % sources of truth on Home |
| **“What’s new” activity digest** | Phase 1 only feeds activity into LuvDaily; couples need an explicit answer to “what’s changed?” |
| **Priority-ordered layout contract (mobile + desktop)** | Replace multi-column pool DOM-order as de facto priority |
| **Venue-need empty state** | Distinct calm state when P1 is clear, unlocking soft P3/P4 invites |
| **Humane overdue presentation rules** | Encode tone + sort boost without corporate shame (rules in §11 / §22) |

No new visual asset requirements in this phase. Exact component file split is deferred to implementation (§26–§28).

---

## 11. Venue-required action prioritization rules

**Definition (Priority 1):** Incomplete items the venue needs from the couple, drawn from the Phase 1 unified synthesis domain:

- Venue tasks (`get_portal_tasks`), including required / final-stretch / wedding-day as mode applies
- Actionable incomplete requests
- Sent contracts awaiting signature (`signToken`)
- Unpaid / non-cancelled payment line items due
- Questionnaire when `status === "sent"`
- Vendor tasks projected to the couple when they represent couple action (nav badge already includes them—attention region should not hide them)

**Ordering within P1**

1. Explicit `overdue` status first (Phase 1 Open Q10 → decide: **yes, boost overdue** beyond pure due-date sort)
2. Then earliest `dueDate` ascending
3. Undated incomplete last (stable)
4. Cap summary list (Phase 1: top 5 is acceptable starting cap; “Open Tasks” for full list)

**Presentation**

- Section/eyebrow framing: venue needs this from you (use venue name when available)
- Primary CTA: open Tasks (SoT); individual rows may deep-link later but must not become a second completer until product decides (Phase 1 Open Q8)
- Do not mix couple personal todos into this list
- Timeline submit items: Home must not silently force `timelineHasUnpublishedChanges: false` if Tasks shows them—align with Tasks SoT (Open Q3)

**Relative to other priorities:** P1 always above P2–P4 in section order and CTA weight while any incomplete P1 item exists.

---

## 12. Couple-owned task prioritization rules

**Definition (Priority 3):** Couple-created planning—Plans/todos, website progress, guest list work, budget work, story writing. Inspiration tips that create todos are **suggestions**, not venue mandates.

**Rules**

- Never appear inside the venue-required attention list
- Surface as launch status + inviting CTAs in **Your planning**
- Personal overdue todos (if shown anywhere on Home) use softer styling and never outrank P1 overdue
- Cold-Home `todoCount` undercount (Phase 1 Open Q2): architecture requires Plans status to load without requiring `TodoSection` mount—data dependency for implementation
- Coming Up / Seasonal “+ Add” remain optional P4→P3 bridges, not attention items

---

## 13. Shared-planning prioritization rules

**Definition (Priority 2):** Timeline, payments (status), messages/team, seating, documents-as-pointers, guide/vendors navigation affordances.

**Rules**

- Appear in **With your venue** after P1 attention
- If a shared item is currently **blocking venue operations** (e.g. unpaid balance, unsigned contract already in unified list), it is treated as **P1** inside attention—not only as a quiet Payments card
- Payments card remains a status pointer; full schedules live in Payments
- Timeline card: peek only (Phase 1: two timed entries)
- Messages / team: roster uniqueness stays on Home; conversation SoT is Messages
- Seating sits in couple planning launches but is categorized shared—status line only

---

## 14. Activity / "what changed" behavior

**Purpose:** Answer “what’s changed?” without becoming a second Messages or Tasks inbox.

| Behavior | Spec |
|----------|------|
| **Input** | `GET /api/portal/activity` (`get_recent_activity`) already loaded on Home for Luv; notification bell remains chrome |
| **Home surface** | Dedicated **What’s new** digest: short list or count of meaningful changes this week (e.g. completed items, venue messages signal, request updates)—observational, click-through to destination |
| **Luv relationship** | Luv may reference weekly activity (Phase 1) but must not be the only place activity appears |
| **Deduping** | If P1 attention already shows the actionable item, What’s new does not invent a second urgent card for the same item; it can note recent completions/calms |
| **Polling** | Notification bell 60s poll stays shell-level; What’s new can refresh with overview remount or light poll—implementation detail under §30 |
| **Empty** | “Nothing new this week—enjoy a quiet moment” (soft); do not manufacture urgency |

---

## 15. Wedding progress behavior

**Problem (Phase 1):** Multiple overlapping % concepts (Next Steps required %, Wedding Planning Progress composite, Snapshot readiness).

**Architecture decision**

- Home exposes **one** progress narrative under **How you’re doing**
- Preferred story: composite readiness aligned to venue-required systems (required tasks + payments + contracts + questionnaire)—because venue business goal centers operational completeness
- Next Steps list does **not** need a second large % bar; a short textual “N left for [Venue]” is enough beside the list
- Snapshot % cells are removed from Home (§9)
- Progress is display-only; completion happens on destination pages
- Progress card returns null when `total === 0` remains acceptable empty handling

**Explicit non-goals:** Recreating Payments/Documents/Questionnaire UIs inside the progress module.

---

## 16. Wedding journey behavior

**Modes (Phase 1 thresholds retained as triggers)**

| Mode | `daysUntil` | Home behavior |
|------|-------------|----------------|
| Standard planning | `> 14` or null (with care) | Full hierarchy §5 |
| Final stretch | `1–14` | Elevate Final Details / P1 checklist emphasis in date-mode band **and** keep Needs your attention; hide or demote pure P4 inspiration that Phase 1 already gates (`du > 14`) |
| Wedding day | `0` | Wedding Day Portal emphasis; ceremony/timeline/key people; incomplete event-day tasks remain P1 |
| Just married | `-3 … -1` | Celebration framing; operational P1 should be rare—don’t invent tasks |
| Keepsake | `< -3` | Post-wedding identity, memories, feedback/referral flows; venue/ops cards quiet unless residual P1 remains |

**Product clarification (answers Phase 1 Open Q1):** Date-mode **emphasizes** contextual content; it does **not** fully replace Hero + Venue attention + Your planning unless residual operational needs are zero. Implementation commentary claiming “replaces” should be corrected when code changes are allowed.

**Journey milestones:** Only live-wired milestones (e.g. guests started/RSVP) may show. Hard-coded `website` / `invitations` false stubs must not appear as incomplete celebrations.

---

## 17. Couple planning feature behavior

| Rule | Spec |
|------|------|
| **Surface** | Launch grid with presence/status lines only (Phase 1 LaunchCard pattern) |
| **Destinations** | `website`, `guests`, `budget`, `seating`, `todos`, `story` remain SoT for editing |
| **Prominence** | Highly visible after venue attention and shared pulse—encourage engagement without competing with P1 |
| **Status accuracy** | Each launch fetches or receives accurate status; fix cold `todoCount` dependency |
| **Inspiration bridge** | Tips live under Enjoy & remember; adding creates couple todos in Plans, never venue tasks |
| **Not a directory** | Do not add every portal section as a launch tile; Prefered Vendors / Guide remain nav |

---

## 18. Luv behavior

| Rule | Spec |
|------|------|
| **Posture** | Suggestions-first, observational, never controlling |
| **Home card** | Single coaching message (Phase 1 priority chain OK as starting logic) under Enjoy & remember |
| **Must not** | Reorder above unresolved P1; shame about overdue venue tasks; present personal tips as venue mandates |
| **FAB / Ask Luv** | Remains available shell-wide for proactive questions; distinct from the passive daily card |
| **Intro** | One-time LuvIntroCard until seen; CTA may guide to Tasks only when P1 exists—otherwise soft explore |
| **Key-date win** | Near key dates may win message priority—still observational tone |
| **Overlap** | Luv voice may mention activity/progress but What’s new + Needs attention own the operational truth |

---

## 19. Memory / journal behavior

| Rule | Spec |
|------|------|
| **Home** | MemoryStrip-style teaser of `latestJournalEntry` only |
| **SoT** | Story / journal destination for writing and history |
| **Keepsake** | Memories upload/view in post-wedding mode remains appropriate on Home band |
| **Priority** | P4—omit quietly if no entry; soft invite to Story optional |
| **Our Story launch** | Remains in Your planning for writing entry |

---

## 20. Empty states

| Context | Behavior |
|---------|----------|
| **P1 attention empty** | Warm venue-need clear state (“You’re all caught up with what [Venue] needs right now”). Then reveal shared pulse + couple planning + enjoy content without fake tasks |
| **Team empty** | Keep Phase 1: “Your venue team will appear here.” |
| **Payments empty / all paid** | Keep calm “All paid up” / empty schedule → View Payments |
| **Timeline empty** | “Your Timeline is being built…” → View Timeline |
| **Progress total 0** | Omit progress module (Phase 1 null) |
| **Key dates none** | Omit card |
| **Requests none** | Omit request slice (do not show empty request alarm) |
| **What’s new empty** | Soft quiet week copy |
| **Memory none** | Omit strip or soft Story invite |
| **Inspiration** | Optional; never fills the P1 slot |
| **Legal pending** | “Preparing your workspace” gate unchanged |
| **Loading** | Prefer lightweight skeletons for P1 attention; avoid permanent blank holes for critical venue needs (improve on Phase 1 cards that return `null` while loading) |

---

## 21. Completed states

| Context | Behavior |
|---------|----------|
| **Venue tasks / unified items** | Completed hidden from attention list; contribute to single progress numerator |
| **Requests** | May show gentle “recently completed” only when no needingAction (Phase 1)—subordinate to empty P1 calm |
| **Payments all paid** | Celebratory calm in payments summary |
| **Journey milestones** | “Done” only for live-true milestones |
| **Final Details / wedding-day tasks** | Completed hidden from Home checklist (Phase 1); full history on Tasks if available |
| **Luv intro dismissed** | Never reappears after marked seen |

Do not keep completed venue items on Home as a long archive.

---

## 22. Overdue states

| Rule | Spec |
|------|------|
| **Detection** | Use PortalTask `overdue` status + past-due payment dates (Phase 1 has status but Home sort ignored it) |
| **Sort** | Overdue P1 before merely upcoming (§11) |
| **Visual** | Clear but hospitable emphasis (attention border/weight)—not alarmist corporate red-blame patterns |
| **Copy** | “Your venue needs this from you” / “[Venue] is waiting on…” / due date in plain language |
| **Avoid** | “You have overdue tasks,” streak punishments, blocking the rest of Home behind a wall of shame |
| **Payments** | Earliest outstanding due (overdue first chronologically) remains; tone matches venue-need |
| **Couple todos** | If overdue personal items ever surface, softer and below P1 |

---

## 23. Mobile hierarchy

Single column, strict:

1. Hero (shorter than desktop emotional height is an implementation choice; keep identity clear)
2. Needs your attention (P1)
3. With your venue (team → payments → timeline condensed)
4. How you’re doing
5. What’s new
6. Your planning launches
7. Enjoy & remember (Luv, inspiration, memory)
8. Date-mode band when active (if P1 final-stretch items exist, they must still appear in attention **or** at the top of the band—never only below inspiration)

Do not use multi-column masonry that reorders cards. Nav and FAB remain thumb-reachable chrome.

---

## 24. Desktop hierarchy

Same logical order as mobile for accessibility and mental model.

Allowed refinement: within **With your venue**, a two-column arrangement of team | payments/timeline **after** the full-width P1 attention region. Progress and What’s new may sit side-by-side only if both remain below P1 and above Your planning.

Hero may use more vertical atmosphere on desktop; CTAs still follow hierarchy.

Do not resurrect unordered CSS `columns` pool as the prioritization mechanism.

---

## 25. Data sources required for each section

| Section | Data sources (Phase 1 mechanisms) |
|---------|-----------------------------------|
| **Legal gate** | SSR legal resolve + `GET /api/portal/legal` |
| **Hero** | `get_portal_context` (venue, client, event, hero image, brand) |
| **Needs your attention** | SSR `get_portal_tasks`, `get_portal_vendor_tasks`; client `GET /api/portal/requests`, payments, questionnaire, documents; `buildUnifiedTaskList` (aligned with Tasks, including timeline-submit flag decision) |
| **With your venue** | `GET /api/portal/venue-team`; payments; `GET /api/portal/timeline` or SSR timeline; key-dates API |
| **How you’re doing** | Required tasks + payments + contracts + questionnaire (same composite inputs as Phase 1 progress card); daysUntil for journey stage |
| **What’s new** | `GET /api/portal/activity` (+ optional notification signal—do not duplicate full inbox) |
| **Your planning** | guests API; website; budget; seating; profile (story, inspiration); **todos count without requiring TodoSection mount** |
| **Enjoy & remember** | Luv observations helpers; activity; key dates; questionnaire; profile `latestJournalEntry`; luv-intro API |
| **Date-mode** | daysUntil; final-stretch/event-day tasks; run-of-show; participants; keepsake/anniversary/memories/feedback/referral APIs as today |
| **Shell** | notifications; export link; nav task badge from initial tasks/vendor tasks |

---

## 26. Existing components that can be reused

Reuse with composition/prop changes rather than greenfield (when implementation begins):

- `PortalShell` / `OverviewSection` (recomposition host)
- `NextStepsCard` logic / `buildUnifiedTaskList`
- `RequestsSummaryCard` attention math (fold in)
- `VenueTeamCard`, `PaymentsCard`, `TimelineCard`
- `LaunchCard` + per-destination launch cards
- `LuvDailyCard`, `LuvIntroCard`, `FloatingLuvWidget` / `LuvAskSection`
- `MemoryStrip`
- `WeddingPlanningProgressCard` (as base for single progress module)
- `KeyDatesCard` (condensed)
- `CoupleNotificationBell`
- `WelcomeExperienceGate`
- Date-mode: `WeddingDaySection` / `WeddingDayPortal`, `KeepsakeSection` / `FeedbackFlow` / `ReferralCard` / `MemoriesSection`
- Observation helpers in `lib/luv/portal-observations.ts`

---

## 27. Components that should be modified

| Component / module | Modification intent (implementation phase) |
|--------------------|--------------------------------------------|
| `OverviewSection` | New section order; remove pool-as-priority; hierarchy CTAs |
| `NextStepsCard` | Venue-need framing, overdue boost, merge request attention, soften duplicate % |
| `buildUnifiedTaskList` call sites | Align timeline-submit flag with Tasks; overdue sort |
| `WeddingPlanningProgressCard` | Become sole Home progress module; absorb journey stage cues |
| Hero block in Overview | CTA policy by hierarchy |
| Launch cards / shell state | Load `todoCount` (or equivalent) on Home |
| `PlanningJourney` / `WeddingSnapshotCard` / `WeddingJourneySection` / `VenueNoteCard` / Coming Up / Seasonal | Demote, merge, or stop mounting per §8–§9 |
| `RequestsSummaryCard` | Fold into attention region rather than independent pool card |
| Date-mode wrappers | Clarify emphasize-vs-replace; keep P1 visibility |

---

## 28. Components that should be created

Create only when composition cannot cleanly extend reused pieces:

| Candidate | Responsibility |
|-----------|----------------|
| **AttentionRegion** (or equivalent) | P1 venue-need list + request attention + empty/overdue states + Open Tasks |
| **HomeProgressSummary** | Single how-you’re-doing module (may wrap modified progress card) |
| **WhatsNewDigest** | Activity / change summary |
| **HomeInspirationCluster** (optional) | Quiet P4 wrap for Coming Up / Seasonal if retained |
| **Hierarchy CTA helper** (optional utility) | Shared rule for hero/primary buttons |

Do not create parallel task, payment, or guest management components on Home.

---

## 29. Information that must NOT be duplicated on Home

- Full Tasks workstation / complete-in-place for all unified tasks
- Full Payments schedules and Stripe checkout UI
- Full Timeline editor / complete run-of-show (except wedding-day band peek)
- Full Documents library management
- Full Messages thread UI (team roster + entry only)
- Full Guests, Website editor, Budget, Seating, Plans editors
- Full notification inbox (bell owns it)
- Multiple conflicting readiness percentages
- Hard-coded faux venue notes as if venue-authored
- Stub journey milestones that contradict live website/guest state
- Recreating Preferred Vendors / Venue Guide content bodies

Destinations remain SoT; Home summarizes and directs.

---

## 30. Performance considerations

- Prefer **one coordinated load** for attention inputs (tasks already SSR; batch client fetches for requests/payments/questionnaire/documents where possible) instead of each card independently racing
- Critical path: context + P1 attention first; defer P4 inspiration/Luv secondary
- Avoid mounting heavy editors on overview
- Do not add multi-column layout cost for prioritization
- Skeleton the attention region; avoid `null`-while-loading gaps for P1
- Activity digest should reuse the existing activity fetch rather than a second heavy feed
- Keep notification poll at shell level (60s) without multiplying pollers per card
- Watch Keepsake/Wedding Day fetches so they only run in applicable date brackets (Phase 1 already date-gates many)

---

## 31. Accessibility considerations

- Preserve a single logical heading order matching §5 (H1-level welcome, then section headings)
- Priority 1 urgency must not rely on color alone; include text (“needed by your venue,” due dates)
- Overdue emphasis must remain readable and not seizure-inducing animation
- CTAs: clear names (“Review what [Venue] needs”) over icon-only
- Cards that currently return `null` while loading should expose polite busy/skeleton states to SR users for P1
- Keyboard order follows visual priority order (no column-reorder traps)
- Floating Ask Luv must not obscure primary attention CTAs on small screens
- Respect reduced-motion for celebratory date-mode surfaces
- `accessLevel` filtering (Open Q4) must not strand view_only / financial users with actionable-looking controls that fail silently—hide or explain

---

## 32. Open implementation dependencies

Carried from Phase 1 open questions + architecture follow-through:

1. **Date-mode “replace” vs emphasize** — Spec chooses emphasize; implementation must update comments/behavior consistently.
2. **`todoCount` on cold Home** — Need API or SSR path so Plans/status do not under-report.
3. **Timeline submit on Home Next Steps** — Align `timelineHasUnpublishedChanges` with Tasks SoT.
4. **`accessLevel` on Overview** — Whether/how to filter Payments, Budget, financial CTAs for `financial` / `view_only` / `planning`.
5. **Venue-authored note** — VenueNoteCard hard-coded; product may later supply real venue notes—until then keep off Home prominence.
6. **WeddingJourneySection wiring** — Live website/invitations milestones or remove stubs.
7. **Requests deep link** — Summary → `tasks` vs `RequestsPortalSection`; confirm canonical Requests destination.
8. **Row click-through on attention items** — Summary-only vs deep-link rows (Open Q8).
9. **Single progress formula ownership** — Confirm composite inputs as the one Home story with venue/product.
10. **Overdue boost** — Spec requires it; confirm PortalTask `overdue` semantics cover all venue-required types including payments/requests.
11. **Language: `/client` vs `/p/{token}`** — Treat `/p/...#overview` as Couple Home in all future packages.
12. **Partial RPC failures for restricted participants** — Define empty vs error vs hidden cards when APIs deny.
13. **Vendor tasks in attention list** — Confirm inclusion parity with nav badge.
14. **What’s new content schema** — Which `get_recent_activity` fields are couple-meaningful enough to list vs count-only.
15. **Feature flags** — None today; if phased rollout is desired, flag strategy is not yet defined.

---

*End of Phase 2 architecture specification. Documentation only. No application code, routes, database, or Home UI changes in this phase.*
