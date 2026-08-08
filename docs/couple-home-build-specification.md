# Couple Home — Phase 3 Build-Ready UX Specification

Specification date: 2026-08-08  
Canonical Home: `/p/{accessToken}` with default section `overview` (`#overview`)  
Authoritative architecture: `docs/couple-home-architecture-specification.md` (Phase 2)  
Current-state fact base: `docs/couple-home-current-state-inventory.md` (Phase 1)  
Scope: Build-ready UX decisions for Couple Home only. Documentation only — no implementation in this phase.

---

## Phase 2 → Phase 3 section crosswalk

| Phase 2 section (architecture) | Phase 3 section (this UX spec) | Notes |
|--------------------------------|--------------------------------|-------|
| Welcome / hero | **Hero / Wedding Snapshot** | Same role; CTA policy tightened |
| Needs your attention | **Your Next Steps** + **Venue Requests Summary** | List is “Your Next Steps”; compact waiting signal is separate (Part 5) |
| With your venue | **Working With Your Venue** | Same P2 collaboration summaries |
| How you’re doing | **Planning Progress** + **Wedding Journey** | One operational % story + one emotional milestone strip (not two %) |
| What’s new | **What’s Happening** | Activity digest rename for warmer tone |
| Your planning | **Your Wedding** | Couple-owned launches |
| Enjoy & remember | **Luv** + **Memories / Planning Journal** | Split for clarity; both remain P4 |
| Date-mode band | Date-mode band (same) | Emphasizes; does not replace Hero + Next Steps |

Visual language remains Hello to Cheers: premium, editorial, warm, quiet, minimal, sophisticated, hospitality-first.

---

# PART 1 — Purpose

## What Home is

Home is the couple’s **wedding-planning home**—the place where their wedding lives day to day. It answers five questions at a glance:

1. How are we doing?
2. What does the venue need from us?
3. What should we do next?
4. What’s changed since we were last here?
5. What can we work on or enjoy?

Home **summarizes and directs** into destination sections that remain the single sources of truth for detailed workflows.

## What Home is not

- A feature directory or app launcher competing with full nav
- A collection of mini-dashboards that recreate Tasks, Payments, Timeline, Guests, Website, Documents, or Messages
- A venue staff task console wearing wedding language
- A notification center or second inbox
- An automation-first AI operator of the couple’s wedding

## Primary couple goal

Feel excited and in control: clear on what the venue still needs, confident about what to do next, oriented to progress and recent change, and invited into joyful planning—without hunting across duplicated screens.

Emotional outcome: **“This is where my wedding lives.”**

## Venue business goal

Reliably receive the information, decisions, documents, payments, and other actions needed from the couple—on time and without burying those needs under recreation.

Venue outcome: **“Wevenu reliably gets what we need from the couple.”**

## Relationship goal

The couple feels hosted by *their* venue, not managed by software. Venue-required work is impossible to miss and easy to complete, while remaining warm, personal, and collaborative. Couple-owned planning stays prominent and enjoyable. Luv stays suggestions-first and observational.

These goals coexist under the core priority hierarchy:

1. Venue-required actions  
2. Shared planning actions  
3. Couple-owned planning  
4. Engagement, inspiration, memories, delight  

---

# PART 2 — Exact Section Order

**Default pre-wedding stack** (standard planning: `daysUntil > 14` or null with care). Legal Welcome gate remains a hard pre-Home gate and is not a Home section.

| Order | Section name | Position | Purpose | Primary audience need | Priority | Desktop placement | Mobile placement |
|------:|--------------|----------|---------|----------------------|----------|-------------------|------------------|
| 1 | **Hero / Wedding Snapshot** | Top of overview | Orient emotionally and temporally; hierarchy-aware CTAs | “Who we are, when the day is, what to do first” | Identity + directs by hierarchy | Full-width hero | Full-width; shorter height OK |
| 2 | **Venue Requests Summary** | Immediately below Hero | Concise “venue is waiting” signal when actionable | Know something needs them without scanning a long list | P1 signal | Full-width compact banner (omit when count = 0) | Same; omit when 0 |
| 3 | **Your Next Steps** | Primary attention region | Make venue-required (and blocking shared) work impossible to miss | Complete what the venue needs next | **P1** | Full-width; strongest attention treatment | Full-width; immediately after banner |
| 4 | **Working With Your Venue** | After Next Steps | Collaboration pulse: team, messages, payments, timeline, next key date | Feel hosted and find venue ops surfaces | **P2** | Full-width region; optional 2-col team \| payments+timeline inside | Single column: team → payments → timeline → key date |
| 5 | **Planning Progress** | After venue collab | One operational readiness narrative | “How far along are we with what matters operationally?” | Mixed summary (venue-aligned) | Full-width, or half-width beside Wedding Journey if both below P1 | Full-width |
| 6 | **Wedding Journey** | Beside / just after Progress | Emotional milestone timeline (not a task list) | Feel progress toward the day | Observational / delight-adjacent | Full-width or paired with Progress | Below Progress |
| 7 | **What’s Happening** | After progress/journey | Observational activity digest | “What changed since I was last here?” | Observational | Full-width (or paired with Progress only if Journey omitted) | Full-width below Journey |
| 8 | **Your Wedding** | After activity | Couple-owned (and seating) destination launches | Enter personal planning joyfully | **P3** | Launch grid (2–3 cols) | Launch stack / 2-col if space |
| 9 | **Luv** | After Your Wedding | One observational suggestion | Gentle coaching; never controlling | **P4** | Full-width quiet card | Below launches |
| 10 | **Memories / Planning Journal** | After Luv | Latest memory teaser | Soft delight / return to Story | **P4** | Full-width strip; omit if empty (optional soft invite) | Below Luv |
| 11 | **Date-mode band** | When `daysUntil` thresholds apply | Emphasize final stretch / wedding day / just married / keepsake | Contextually urgent or celebratory | Mode-specific | Full-width; **must not hide unresolved P1** already shown in Your Next Steps | Same; P1 remains earlier in stack |

**Shell (outside overview composition):** sticky header, `NAV_ITEMS`, footer, Floating Ask Luv FAB, Couple Notification Bell. Shell must not contradict hierarchy (Tasks badge remains P1-aligned chrome).

### Decisive layout rules

- Multi-column CSS pools are **not** an allowed prioritization mechanism.
- Priority 4 never precedes unresolved Priority 1 in the default stack.
- Date-mode **emphasizes** contextual content; it does **not** replace Hero + Your Next Steps + Your Wedding while residual operational needs exist.

---

# PART 3 — Hero / Wedding Snapshot

Exact content hierarchy (top → bottom). No metrics grid. No second dashboard.

| Layer | Content | Rules |
|-------|---------|--------|
| 1. Atmosphere | Venue hero image or brand gradient | Edge-to-editorial warmth; not a card gallery |
| 2. Venue eyebrow | Venue name | Identifies host |
| 3. Couple names | `{first} & {partner}` | Hero-level brand/identity signal for the couple |
| 4. Countdown | `N days until…` / `Today is the day` / married duration when post-day | Single temporal anchor; do not also show Snapshot-style metric cells |
| 5. Overall planning status | One short line | Prefer: “N things [Venue] still needs from you” when P1 count > 0; else “You’re all set with [Venue] for now” or “Your wedding home is ready whenever you are” | No large % bar in the hero |
| 6. Supporting message | One warm reassurance sentence | Example: “Your venue team is here with you—finish what helps your day come together.” |
| 7. Primary action | Single primary CTA | **If P1 incomplete > 0:** “Review what [Venue] needs” → `tasks`. **Else:** “Continue planning” → `todos` (or first incomplete couple launch if Plans empty) |
| 8. Secondary actions | Max **2** text/quiet buttons | Prefer: Message [Venue] → `messages`; View Timeline → `timeline`. Never equal-weight a stack of four peer primaries |

### Explicit non-goals in Hero

- Guest counts, todo counts, readiness percentage cells  
- Equal primary CTAs that compete with venue needs when P1 exists  
- Hard-coded faux venue quotes  

---

# PART 4 — Venue-Required Actions

## Section heading (required)

**Your Next Steps**

Optional eyebrow when venue name known: `From [Venue]` or `What [Venue] needs from you`

## Ownership labels inside the list

Every visible row carries exactly one of:

| Label | Meaning | Includes |
|-------|---------|----------|
| **From your venue** | Venue-required couple action | Venue tasks (incl. required / final-stretch / wedding-day as mode applies), actionable incomplete requests, sent contracts awaiting signature, questionnaire when `status === "sent"`, vendor tasks that require couple action |
| **Shared planning** | Shared but currently blocking / due action surfaced here | Unpaid/non-cancelled payment obligations due; timeline-submit items when Tasks SoT would show them (`timelineHasUnpublishedChanges` **aligned with Tasks**—Home must not force `false`) |
| **For your wedding** | **Never** shown in this list | Couple personal Plans/todos, inspiration tips, journal prompts |

Couple-created items **must not** appear in Your Next Steps. Venue-required always outranks couple-created when competing for prominence elsewhere on Home.

## Max displayed initially

**5** incomplete items.

Footer CTA when more exist or always for full SoT: **“Open all tasks”** → `tasks`.

## Ordering

1. Explicit overdue (`status === "overdue"` or past-due payments treated as overdue) first  
2. Then earliest `dueDate` ascending  
3. Undated incomplete last (stable)  
4. Within equal dates, preserve stable synthesis order from `buildUnifiedTaskList`

## Due-date presentation

- Show plain-language due when present: `Due Mar 12` / `Due tomorrow` / `Due today`  
- Undated: omit fake dates  

## Overdue presentation

- Warm emphasis (border/weight + text)—not corporate red-blame walls  
- Copy pattern: “Your venue needs this from you” / “[Venue] is waiting on this”  
- **Avoid:** “You have overdue tasks,” guilt, streak punishment  
- Overdue couple personal todos (if ever shown elsewhere) never visually outrank these  

## Required presentation

- If `isRequired`, show a quiet “Required” cue in text (not color-only)  
- Required status feeds Planning Progress; list itself stays scannable titles + ownership + due  

## Completed presentation

- Completed items **hidden** from Your Next Steps  
- They contribute to Planning Progress numerator  
- Do not keep a long completed archive on Home  

## Empty state

Warm calm—not unfinished product:

> You’re all caught up with what [Venue] needs right now.

Secondary: “Open all tasks” still available (quiet). Then the page continues into Working With Your Venue and below—no manufactured fake tasks.

## CTA / row behavior

| Control | Behavior |
|---------|----------|
| Primary section CTA | “Open all tasks” → `tasks` (SoT for completion) |
| Row click | Navigate to `tasks` (deep-link/focus item when platform supports it). **No complete-in-place** on Home |
| Payments / contracts / questionnaire rows | Same: direct into Tasks/Payments/Documents destinations via Tasks SoT routing; Home does not host Stripe, signing UIs, or questionnaire forms |

## Loading

Skeleton the attention region. Do not return a permanent blank hole for P1 while loading.

---

# PART 5 — Venue Requests Summary

## Whether it appears

**Yes**, when actionable venue-waiting count > 0.  
**Omit entirely** when count = 0 (do not show an empty “0 waiting” alarm).

## Exact wording

| Count | Copy |
|------:|------|
| 1 | “[Venue] is waiting on 1 thing from you.” |
| 2+ | “[Venue] is waiting on {N} things from you.” |

Fallback if venue name missing: “Your venue is waiting on {N} thing(s) from you.”

Optional quiet subline (one only): “Jump to your next steps below.” — do not paste task titles here.

## Count behavior

- **N** = count of incomplete Priority-1 items using the same unified synthesis as Your Next Steps (tasks + actionable requests + unsigned sent contracts + unpaid due obligations + sent questionnaire + couple-action vendor tasks + aligned timeline-submit).  
- Banner uses the **full count**, not the capped list of 5.  
- When N = 0, omit the banner (Your Next Steps empty state carries the calm message).

## Placement

Order position **2** — between Hero and Your Next Steps. Full-width compact banner/line. Not a second card listing every request.

## Interaction

- Entire banner clickable → scrolls/focuses **Your Next Steps**, or navigates to `tasks` if Next Steps not yet mounted.  
- Does **not** open a separate Requests workstation. Canonical requests handling remains Tasks SoT (`tasks`), consistent with Phase 1 summary navigation.

## Deduping

Does not duplicate the full list. Your Next Steps owns titles; this owns the one-line “waiting on you” urgency.

---

# PART 6 — What’s Happening

Purpose: answer “what’s changed?” without becoming a notification center or second Messages/Tasks inbox.

## Section heading

**What’s Happening**

Optional subhead when returning visitor: **“Since you were last here”** (use portal `last_accessed_at` when available; else “This week”).

## Included activity types (observational)

| Type | Couple meaning | Click-through |
|------|----------------|---------------|
| Venue messages | New/unread venue message signal | `messages` |
| Vendor activity | Meaningful vendor update visible to couple | destination appropriate / Tasks if action |
| RSVP / guests | RSVP spikes or guest-list milestones | `guests` |
| Documents | New shared docs / contract state changes (if not already the sole P1 row) | `documents` or `tasks` |
| Timeline | Notable timeline publishes / day-plan updates | `timeline` |
| Payments | Payment recorded / new schedule item | `payments` |
| Website | Publish or major website update | `website` |
| Important planning events | Completions, request resolved, key-date passed | matching destination |

## Max visible items

**5** items initially.  
If more: “See earlier activity” is **not** required on Home—omit or single quiet “That’s the latest” line. Full inbox stays in the notification bell.

## Time grouping

- Group labels only: **Today**, **Earlier this week**, **Earlier** (max three groups).  
- Do not build a dense chron feed.

## Read / unread

- Unread/new items may use a small text cue (“New”)—not loud badge clusters.  
- Notification bell remains chrome SoT for inbox management.  
- What’s Happening does **not** mark notifications read in bulk as a substitute for the bell.

## “Since you were last here”

- Prefer activity with `timestamp > last_accessed_at` when that field is available from context.  
- If none since last visit but week activity exists, fall back to “This week” and soft copy.  
- Empty: “Nothing new since you were last here—enjoy a quiet moment.”

## CTA

- Row click → relevant destination only.  
- No “Mark all read” primary on Home.  
- Do not invent urgency for P4 tips.

## Deduping with Your Next Steps

If an item is still an incomplete P1 action, What’s Happening may note a **state change** (“New request from [Venue]”) but must not create a second urgent workstation card for the same item. Completions/calms are preferred here.

## Data

Reuse `GET /api/portal/activity` (`get_recent_activity`) already loaded for Luv. Do not add a second heavy feed.

---

# PART 7 — Planning Progress

## Purpose

One coherent answer: **how ready is wedding ops with the venue?**

## Section heading

**Planning Progress**

## What appears

| Element | Spec |
|---------|------|
| Overall progress | **One** percentage + short supporting line |
| Supporting line | “Based on required venue tasks, payments, contracts, and your questionnaire.” |
| Categories (display-only chips or quiet breakdown) | Required tasks · Payments · Contracts · Questionnaire — counts or mini segments **from the same formula**, not alternate % stories |
| Clickable? | **No** category deep editors. Optional whole-module quiet link “Review what’s left” → `tasks` when incomplete > 0 |

## Calculation source (single SoT on Home)

Composite readiness aligned to venue-required systems (Phase 1 `WeddingPlanningProgressCard` inputs):

- Required venue tasks complete / total required  
- Paid payment line items / payable lines  
- Signed contracts / contracts in scope  
- Questionnaire submitted when in scope  

This is the **only** Home percentage. Remove from Home composition: Next Steps large readiness bar, Snapshot readiness cells, PlanningJourney competing %, hard-coded journey stub incompleteness presented as %.

## Empty / zero

When `total === 0`, **omit** the module (same as Phase 1 null behavior).

## Completed contribution

Completed required systems increase the numerator; completed items do not remain listed in Your Next Steps.

---

# PART 8 — Wedding Journey

## Purpose

Emotional milestone strip: where they are in the arc of planning → wedding day → after. **Not** another task list and **not** a second percentage.

## Section heading

**Wedding Journey**

## Milestone states

| State | Visual / copy |
|-------|----------------|
| Completed | Quiet check / “Done” — live-true only |
| Current | Clear “You’re here” emphasis |
| Upcoming | Soft, not dimmed into invisibility |
| Wedding day | Elevates when `daysUntil === 0` (with date-mode band) |

## Milestone content rules

- Show **only live-wired** milestones (e.g. guests started, RSVPs arriving, venue tasks progressing as stage cues).  
- **Do not ship** hard-coded `website` / `invitations` false stubs as incompletes.  
- Max **5–7** milestones visible in the strip.  
- No complete-in-place. Clicking a milestone may navigate to the related destination when obvious (e.g. Guests); otherwise display-only.

## Relationship to Planning Progress

- Progress = operational %  
- Journey = emotional / temporal arc  
They sit adjacent but must not show conflicting percentages.

---

# PART 9 — Your Wedding

Section heading: **Your Wedding**  
Purpose: couple-owned destinations with presence/status only—no destination dashboards on Home.

## Launch tiles (ship these)

| Destination | On Home | Not on Home | CTA |
|-------------|---------|-------------|-----|
| **Website** | Status: Published ✓ or N% complete | Editor, sections, publish UI | Open Website → `website` |
| **Guests** | “N invited, M confirmed” (or empty invite) | Full guest CRM / RSVP management | Open Guest List → `guests` |
| **Budget** | “$spent of $total” when access allows | Full budget editor | Open Budget → `budget` |
| **Seating** | Unassigned count / All seated (shared; launch lives here) | Floor-plan editor | Open Seating → `seating` |
| **Plans** | Accurate todo/inspiration count (**must load on cold Home**—fix Phase 1 `todoCount` dependency) | Full Plans/todo workstation | Continue Plans → `todos` |
| **Our Story / Planning Journal entry** | “Written ✓” or “Start your story” | Full journal editor & history | Open Our Story → `story` |

## Evaluated but not default Home launches

| Idea | Decision |
|------|----------|
| **Registry** | **Do not add** until a couple Registry destination exists in portal. Home must not teaser a dead end. |
| **Inspiration** | Not a launch tile. Soft tips live under **Luv** / optional quiet inspiration cluster in P4 only. |
| **Photos** | Not a pre-wedding Home tile. Meaningful photo surfaces belong to Keepsake / Memories post-wedding or Story media—not an empty Photos dashboard on Home. |

## Rules

- Highly visible **after** P1 and P2.  
- Status lines only; editing on destinations.  
- Do not add every nav item (Preferred Vendors, Venue Guide stay in nav / Working With Your Venue pointers).

---

# PART 10 — Working With Your Venue

Section heading: **Working With Your Venue**

| Surface | Home summarizes | Destination executes |
|---------|-----------------|----------------------|
| **Venue Team** | Up to **3** people: name/role + Message / mailto | Full conversation in Messages; roster uniqueness OK on Home |
| **Messages** | Entry CTA from team (“Message [Venue]”) — no thread UI | `messages` |
| **Timeline** | Next **2** timed entries | Full Timeline / run-of-show in `timeline` |
| **Documents** | No library on Home; document/contract needs appear as P1 rows in Your Next Steps | `documents` / signing flows |
| **Payments** | Condensed: balance / next due / All paid up; Pay Now only as pointer into Payments | Full schedules + Stripe in `payments` |
| **Venue Guide** | Optional text link “Explore your Venue Guide” (not a content body) | `guide` |
| **Vendors** | Optional text link “Preferred vendors” | `vendors` |
| **Key date** | Single next venue key date (+ optional 2 quieter upcoming max) | No separate couple Key Dates app; omit card if none |

### Empty copy (keep warm)

- Team: “Your venue team will appear here.”  
- Payments empty schedule: calm View Payments.  
- Payments all paid: “All paid up.”  
- Timeline: “Your Timeline is being built…” → View Timeline.

Blocking unpaid/sign obligations still appear as **P1** in Your Next Steps, not only as quiet Payments status.

---

# PART 11 — Luv

## Posture

Suggestions first. Observational. Helpful. Never controlling. Never automation-first. Never shame about overdue venue work.

## Placement

Order position **9** — after **Your Wedding**, before Memories. Must **not** compete visually with Your Next Steps (no rose urgency border competing with P1; quieter card).

## Home surface

Exactly **one** coaching message (Phase 1 `LuvDailyCard` priority chain is acceptable starting logic):

Observation types allowed (examples):

- Near key-date gentle reminder  
- Progress/celebration observation (“You’re making real headway”)  
- Quiet week / activity reflection  
- Questionnaire gentle nudge only when not already screaming in P1 (prefer P1 ownership when actionable)  
- Seasonal / stage tip as **suggestion** (“If you’d like…”)  
- Milestone / social-proof warmth  

## Exact constraints

| Must | Must not |
|------|----------|
| One message | Chatbot panel inline on Home |
| Optional soft CTA → relevant destination | Intrusive popups / auto-expand over Next Steps |
| One-time `LuvIntroCard` until seen | Reorder above unresolved P1 |
| FAB Ask Luv remains shell-wide for proactive Q&A | Present personal tips as venue mandates |
| | Home-local delight badge counts |

Intro CTA: if P1 exists → may guide to Tasks; else soft explore (Plans / Story).

---

# PART 12 — Memories / Planning Journal

## Placement

Order position **10** (P4), after Luv.

## Content

- Teaser of `latestJournalEntry` only (MemoryStrip pattern): short excerpt / media thumb + warm label  
- Heading example: “A moment from your journey”

## Max items

**1** latest entry.

## CTA

Click → `story` (journal writing & history SoT).

## Empty state

Prefer **omit** strip when no entry.  
Optional soft invite (never loud): “Capture a note in your planning journal when you’re ready.” → `story`.

## Keepsake mode

Post-wedding Memories upload/view may appear in the **date-mode band**—appropriate then; do not duplicate a pre-wedding Photos dashboard.

## Priority

Engagement/delight only. Never above unresolved P1.

---

# PART 13 — Empty States

Gentle invitations—not unfinished product.

| Context | Exact behavior / copy pattern |
|---------|-------------------------------|
| **No venue requests / P1 clear** | Omit Venue Requests Summary. Your Next Steps: “You’re all caught up with what [Venue] needs right now.” |
| **No tasks (all complete)** | Same as P1 clear; quiet “Open all tasks” still OK |
| **No activity** | What’s Happening: “Nothing new since you were last here—enjoy a quiet moment.” (or quiet week variant) |
| **No vendors** | Do not show an empty Preferred Vendors module on Home; nav may still exist. Optional Working With Your Venue link only if destination has content later |
| **No messages / empty team** | Team: “Your venue team will appear here.” No fake unread Counts |
| **No journal** | Omit Memory strip or soft Story invite (Part 12) |
| **No website** | Website launch: inviting status (“Start your wedding website”) — not an error |
| **No guests** | Guests launch: “Begin your guest list” — warm invite |
| **Payments none / all paid** | Calm empty or “All paid up” + View Payments |
| **Timeline empty** | “Your Timeline is being built…” |
| **Progress total 0** | Omit Planning Progress |
| **Key dates none** | Omit key-date summary |
| **Legal pending** | “Preparing your workspace” gate unchanged |
| **Inspiration unused** | Simply omit P4 inspiration; never fill the P1 slot |

---

# PART 14 — Responsive Hierarchy

Mobile is **not** desktop-stacked unchanged. Strict single-column priority:

1. Hero / Wedding Snapshot (identity clear; height may compress)  
2. Venue Requests Summary *(if N > 0)*  
3. Your Next Steps (**P1**)  
4. Working With Your Venue — team → payments → timeline → next key date  
5. Planning Progress  
6. Wedding Journey  
7. What’s Happening  
8. Your Wedding launches  
9. Luv  
10. Memories / Planning Journal  
11. Date-mode band when active — if final-stretch/wedding-day incomplete tasks exist, they **also** appear in Your Next Steps (earlier); band must not be the only place they hide below inspiration  

### Viewport pressure

Collapse/defer first: Memories → Luv tips/inspiration → Journey decorative detail → Progress category chips (keep overall % if present) → Venue Guide/Vendors text links.  
**Never** collapse Your Next Steps before P4 content.

Nav + Ask Luv FAB remain thumb-reachable chrome; FAB must not cover primary Next Steps CTA.

Desktop: same logical reading order. Allowed refinement: within Working With Your Venue, two columns (team | payments+timeline) **after** full-width P1. Progress + Journey may sit side-by-side below P1.

---

# PART 15 — Content Rules

Warm, clear, action-oriented hospitality language.

## Prefer

| Instead of… | Use… |
|-------------|------|
| “You have overdue tasks” | “Your venue needs this from you” / “[Venue] is waiting on this” |
| “Action required” walls | “Something [Venue] is waiting on” |
| “Incomplete mandatory items” | “Finish what helps your day come together” |
| “0 notifications” empty alarms | Soft quiet-week / all-caught-up copy |
| Generic SaaS “Dashboard” | “Your wedding home” |
| “Submit compliance form” | “Complete your questionnaire for [Venue]” |

## Approved pattern examples

- “Welcome to your wedding home.”  
- “You’re all caught up with what [Venue] needs right now.”  
- “[Venue] is waiting on 2 things from you.”  
- “Review what [Venue] needs”  
- “Continue planning”  
- “Nothing new since you were last here—enjoy a quiet moment.”  
- “Your Timeline is being built…”  
- “Your venue team will appear here.”  
- “All paid up.”  
- “Capture a note when you’re ready.”  
- Luv: “If you’d like a gentle next idea…” (suggestion, not command)

## Avoid

Harsh warning-heavy language, guilt, shame, corporate compliance tone, treating personal todos as venue mandates, fake urgency for delight content.

---

# PART 16 — What MUST NOT appear on Home

Home summarizes; destinations execute. Explicit exclusions:

1. Full Tasks workstation / complete-in-place for unified tasks  
2. Full Payments schedules and Stripe checkout UI  
3. Full Timeline editor / complete run-of-show (wedding-day band may peek only)  
4. Full Documents library management  
5. Full Messages thread UI (team roster + entry only)  
6. Full Guests, Website editor, Budget, Seating, Plans editors  
7. Full notification inbox (bell owns it)  
8. Multiple conflicting readiness percentages  
9. Wedding Snapshot metrics grid  
10. Hard-coded faux venue notes presented as venue-authored  
11. Stub journey milestones that contradict live website/guest state  
12. Preferred Vendors / Venue Guide content bodies  
13. Registry / Photos destination dashboards without real destinations  
14. Seasonal / Coming Up tip banks as primary work lists above P1  
15. Chatbot takeover or intrusive Luv popups over attention  
16. Couple personal todos mixed into Your Next Steps  

---

# PART 17 — Component Mapping

Grounded in Phase 1 inventory + Phase 2 mapping. **Do not implement in this phase.**

| Home section | Existing reusable | Modify | New required | Existing data | New data required? | Existing RPC/API | New RPC/API required? |
|--------------|-------------------|--------|--------------|---------------|--------------------|------------------|------------------------|
| Hero / Wedding Snapshot | Hero block in `OverviewSection` | CTA hierarchy policy; status line; drop equal peer CTA stack | Optional tiny CTA helper util | `get_portal_context` | No | SSR context | No |
| Venue Requests Summary | Attention math from `RequestsSummaryCard` + unified count | Fold count into banner; stop independent pool card | Compact banner component (or attention subview) | Unified incomplete count (tasks, requests, payments, docs, questionnaire) | No new domain | `get_portal_tasks`, vendor tasks, `/api/portal/requests`, payments, questionnaire, documents | No |
| Your Next Steps | `NextStepsCard`, `buildUnifiedTaskList` | Venue-need framing; overdue boost; ownership labels; align timeline-submit flag; remove duplicate large % bar | `AttentionRegion` (or equivalent composition) recommended | Same unified inputs | Align `timelineHasUnpublishedChanges` with Tasks | Same as Phase 1 Next Steps | No new RPC; wiring fix |
| Working With Your Venue | `VenueTeamCard`, `PaymentsCard`, `TimelineCard`, `KeyDatesCard` | Compose under one section; optional Guide/Vendors text links | Section wrapper | `/api/portal/venue-team`, payments, timeline, key-dates | No | Existing portal APIs | No |
| Planning Progress | `WeddingPlanningProgressCard` | Become **sole** Home % module | Optional rename wrapper `HomeProgressSummary` | Required tasks + payments + contracts + questionnaire | No second formula | Existing client fetches | No |
| Wedding Journey | `PlanningJourney` / live bits of `WeddingJourneySection` | Remove stub incompletes; emotional strip only | May thin-wrap existing | `daysUntil`, live guest/progress cues | Live website status if milestone kept | guests API; website API if wired | Only if adding true website milestone |
| What’s Happening | Activity already fetched for Luv | Surface dedicated digest | **`WhatsNewDigest`** (new) | `GET /api/portal/activity` (`get_recent_activity`); `last_accessed_at` from context | Prefer reuse; schema choose couple-meaningful fields | Existing activity API | No new API required for v1 |
| Your Wedding | `YourWeddingSection`, `LaunchCard` + six launch cards | Fix cold `todoCount`; drop Snapshot-driven metrics dependence | None if launches extend | guests, website, budget, seating, profile, todos count | **Todos count without TodoSection mount** | Existing + Plans count path | May need existing todos list endpoint wired on Home (no new DB) |
| Luv | `LuvDailyCard`, `LuvIntroCard`, observation helpers | Ensure P4 placement; non-competing chrome | Optional quiet inspiration cluster only if retained | observations, activity, key dates, questionnaire, luv-intro | No | Existing luv + activity APIs | No |
| Memories / Planning Journal | `MemoryStrip`, Story launch | Soft empty invite rules | None required | `profile.latestJournalEntry` | No | `/api/portal/profile` | No |
| Date-mode band | `WeddingDaySection` / `WeddingDayPortal`, `KeepsakeSection`, Feedback/Referral/Memories | Emphasize-not-replace; keep P1 visibility | None | daysUntil + mode APIs | No | Existing | No |
| Stop mounting on Home | — | — | — | — | — | — | — |
| → Remove from composition | `WeddingSnapshotCard`, standalone `RequestsSummaryCard` pool card, hard-coded `VenueNoteCard`, competing % (`PlanningJourney` % duplicate, Next Steps large readiness bar), stub `WeddingJourneySection` incompletes, Coming Up / Seasonal as peer “work” | Demote inspiration under P4 only if kept | — | — | — | — | — |
| Shell (unchanged role) | `PortalShell`, `CoupleNotificationBell`, `FloatingLuvWidget`, `WelcomeExperienceGate`, `NAV_ITEMS` | accessLevel filtering for financial CTAs on overview when implementing | — | notifications, legal | Policy: hide or explain for `view_only` / limited financial | Existing | No |

**Permissions:** Preserve portal token security and legal gate. On implementation, Overview must respect `accessLevel` so `view_only` / `financial` / `planning` users never see actionable controls that silently fail.

---

# PART 18 — Acceptance Criteria

Measurable criteria for a future implementation review (this phase ships docs only).

1. **Venue-required prioritized:** When any incomplete P1 item exists, Venue Requests Summary (if N > 0) and Your Next Steps appear above Working With Your Venue, Your Wedding, Luv, and Memories in both desktop and mobile reading order.  
2. **No burial under recreation:** No P4 module (Luv, Memories, inspiration tips) appears above unresolved P1 content in the default stack.  
3. **Section heading locked:** Venue-required list section is titled **Your Next Steps**.  
4. **Ownership labels:** Visible Next Steps rows use only “From your venue” or “Shared planning”; couple personal todos never appear in that list.  
5. **Cap & order:** At most **5** Next Steps rows; overdue before due-date before undated.  
6. **Waiting signal:** Banner copy matches Part 5; omitted when N = 0; does not list all task titles.  
7. **No duplicate workflows:** Home does not host complete-in-place tasks, Stripe checkout, full timeline editor, documents library, messages threads, or guest/website/budget editors.  
8. **Single progress %:** Exactly one Home operational percentage (Planning Progress); Snapshot / competing readiness bars absent.  
9. **Wedding Journey non-tasks:** Journey shows live milestones only; no hard-coded false website/invitations incompletes.  
10. **Engaging couple planning:** Your Wedding launches remain visible after P1/P2 with accurate status (including cold-Home Plans count).  
11. **Activity understandable:** What’s Happening shows ≤5 observational items with time grouping and destination CTAs; empty state is calm, not alarming.  
12. **Luv suggestions-first:** Single observational card below Your Wedding; no chatbot/popup covering Next Steps; does not outrank P1.  
13. **Mobile hierarchy:** Mobile order matches Part 14; no multi-column reordering that elevates P4.  
14. **Empty states warm:** P1-clear, no-activity, no-team, no-journal, no-website, no-guests match Part 13 — invitations, not error scaffolding.  
15. **Permissions intact:** Invalid token still blocked; legal gate still blocks Home; restricted `accessLevel` does not present failing financial actions as enabled.  
16. **Sources of truth preserved:** Tasks, Payments, Timeline, Documents, Messages, Guests, Website, Budget, Seating, Plans, Story remain SoT for execution; Home only summarizes and directs.  
17. **Timeline parity:** Home Next Steps does not hide timeline-submit items that Tasks shows.  
18. **Tone:** No “You have overdue tasks” (or equivalent shame copy) in Home attention surfaces; overdue uses venue-collaborative language from Part 15.  
19. **Date-mode:** Final stretch / wedding day / keepsake emphasize context without removing Hero + Next Steps while residual P1 remains.  
20. **Shell signals:** Nav Tasks badge remains the chrome signal for incomplete completable venue/vendor work; Home does not invent competing P4 badge counts.

---

## Build decisions log (Phase 2 open items resolved for UX)

| Topic | Build-ready decision |
|-------|----------------------|
| Date-mode replace vs emphasize | **Emphasize** |
| Cold Home `todoCount` | **Must load** with Home |
| Timeline submit on Home | **Align with Tasks SoT** |
| `accessLevel` | **Hide or explain** financial/restricted actions |
| VenueNoteCard | **Off Home** until venue-authored |
| Journey stubs | **Do not ship** false incompletes |
| Requests destination | **`tasks`** canonical from Home |
| Row interaction | **Navigate to Tasks**; no complete-in-place |
| Progress formula | **Composite venue-required systems** = sole Home % |
| Overdue | **Boost** overdue above mere chronological peers |
| Canonical URL language | **`/p/{token}#overview`** is Couple Home |
| Vendor tasks in attention | **Include** (parity with nav badge) |
| What’s Happening volume | **Max 5** listed items |
| Registry / Photos launches | **Not on Home** until real destinations / meaningful keepsake |

---

*End of Phase 3 build-ready UX specification. Documentation only. No application code, routes, database, or Home UI changes in this phase.*
