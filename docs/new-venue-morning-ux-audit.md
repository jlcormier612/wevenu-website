# "New Venue Morning" — Cross-Product UX Audit

**Type:** Discovery/UX audit only. No code, schema, navigation, copy, Help & Guides, or Luv content was modified to produce this document.
**Method:** This audit combines two evidence sources, and every finding below is labeled by which one produced it. **(Live)** — captured by driving the actual running application in a real browser session (Playwright against `localhost:3000`), logged in as `owner@example.com` on **Sweet Daisy Barn & Farm**, a realistically-seeded dev venue (7 leads, 1 active Pipeline Template, 5 Automations, 13 enrollments, 5 clients, 33 contracts) — chosen over a truly blank account specifically because a genuinely empty Day 1 venue cannot exercise Pipeline, Automations, or Contracts at all, and this audit needed to see those working. Screenshots were taken and visually inspected, not just text-scraped. **(Code)** — read directly from the current working tree where a live click would have required mutating real records (e.g., actually signing a contract) or where the fastest, most reliable way to confirm exact copy was the source file itself. Anywhere this account's seeded data is visibly test-fixture noise (e.g., leads and Automations named "P0Lost Validation," "Po Cancelled Goodbye") it is called out explicitly as such and not treated as a product defect.

---

## Executive Summary

The core of Hello to Cheers is genuinely good, and in several places better than the brief's own cautious framing suggested it might be. The sidebar, Library, the Event workspace, the Automation builder, and the venue-first Contract signing screen all pass the "would a nervous, non-technical venue owner understand this without help" test on direct, live inspection — with real, human, plain-language copy throughout, not technical jargon. The team has clearly already internalized and acted on findings from this engagement's own prior audits: the Automation editor now explicitly states "Changes apply to new enrollments only," and the trigger picker now shows all seven canonical stages with the venue's own stage names attached, exactly as recommended.

**But two things would genuinely stop a first-time venue owner, and both are small, precise, and fixable.** First: the Pipeline Templates page — the exact place a venue configures the thing this whole system is built around — tells them, in its own words, that their pipeline "is not connected to Leads yet." This is false; the Pipeline board demonstrably uses it, live, confirmed by dragging a real lead. A product that tells a working feature it's broken is worse for trust than a product that's honestly incomplete. Second: dragging a lead's card between Pipeline stages can silently fire a real, customer-facing Automation with no confirmation, warning, or visible signal at the moment of the drag — a nervous venue owner reorganizing their board for their own clarity has no way to know they just emailed someone.

Everything else found is real but smaller: one empty "Getting Started" category sitting at the very top of Help & Guides, a branding hint that promises colors will appear somewhere they mostly don't, a couple of small label inconsistencies. None of these are architectural problems. All of them are the kind of thing that gets fixed in an afternoon once named precisely — which is what this document does.

---

## Overall Verdict

**Not release-blocked, but not silent-ready either.** A venue owner could open Hello to Cheers tomorrow morning, understand the sidebar, find their leads, understand their Pipeline board, send a contract, and get paid — without a human beside them, for the large majority of their first session. Two things in this list (the stale Pipeline copy, the silent-automation-on-drag risk) are the kind of finding that should be fixed before this is put in front of a real, unassisted first customer. Everything else can wait for the next ordinary iteration.

---

## First 30 Minutes

**A. Where do I start? Is the Dashboard useful?** **(Live)** Confirmed genuinely good. "Good evening, Jennifer." with the date and venue name, a dismissible one-line note about the daily email digest, then three cards: **Morning Briefing** ("What matters today, in order"), **Today's Attention** ("Everything that needs a decision or an action right now"), and **Upcoming** ("What's coming up, across everything"). Every card header explains itself in one plain sentence — this is real, working progressive disclosure, not a wall of widgets. **One confirmed redundancy:** in this account, Morning Briefing and Today's Attention show the *exact same two people* with the *exact same line of text* ("New inquiry 20 days old — no follow-up scheduled"), back to back. Not confusing, exactly, but a venue owner would reasonably ask "why did I just read this twice?" **P2.**

**B. What does the sidebar tell me?** **(Live)** Yes — confirmed, the eight sections (Overview, Sales, Clients, Communication, Tasks, Financials, Library, Your Venue) read as plain business categories, not technical ones. No jargon in any top-level label.

**C. What is Library?** **(Live)** Confirmed excellent. The page's own first sentence: *"Your venue's toolbox — everything reusable, in one place. Templates you build once and use for every wedding."* This single sentence does more comprehension work than any tooltip could. Every card underneath repeats the pattern in its own words ("What you offer — customize inclusions and set your price before adding to an event or invoice"). A first-time venue owner would understand what belongs here within seconds.

**D. What is Help & Guides?** **(Live)** The destination itself is well-named and one click away from Overview, with a clear tagline ("Quick answers for using Hello to Cheers"). But its very first category — **Getting Started**, the one a lost new user is most likely to open first — says *"Guides for this area are coming soon."* See Help & Guides P0 Content, below.

**E. What is Luv? If she appears, is her role obvious?** **(Live + Code)** On the real venue Dashboard, Luv is a single small card, titled "💗 Luv," holding at most one observation and one recommendation — confirmed directly in `app/(app)/dashboard/page.tsx`'s own comment: *"at most one observation, one recommendation, one action. No placeholder AI: renders nothing if Luv has nothing to say."* This is exactly the restraint the brief asked for, already built. A first-time-only intro card also exists, dismissible, one line: *"I'll help you stay ahead of everything happening at your venue."* Her role reads as "a quiet assistant who sometimes has something to say," which is obvious and correctly modest. **Do Not Touch.**

**Methodological note:** every screenshot in this audit shows a small dark circle in the bottom-left corner with an "N." This is **not Luv** — it is the Next.js development-server error overlay, confirmed by clicking it (see Trust/Safety, below, for what it revealed). It will not appear in production. It should not be confused with any real product surface.

---

## Core Venue Journeys

### Journey 1 — Set up the venue

**(Code)** The Setup wizard's Brand step asks for four colors with real, plain-English hints: *"Primary — Main brand color: buttons, headers, accents," "Secondary — Supports the primary: sidebar, badges," "Accent — Warm tone: highlights, cards, hover states," "Neutral — Background tone: page canvas, section fills."* This is good, confident, unintimidating copy — a venue owner would not feel lost picking four colors.

**The problem is what happens after.** Per this engagement's own prior, directly-relevant certification (`docs/venue-white-label-collateral-certification.md`, verified quantitatively via grep counts across the codebase): Primary is used **110 times**, Secondary **5 times**, Accent **19 times**, Neutral **6 times** — and the overwhelming majority of that usage is confined to the Couple Portal and the Contract sign page, **not the venue's own day-to-day interface**. The Brand step's own hint text says Secondary controls "the sidebar" — but it is not the venue's own sidebar (the one they're looking at in Settings right now); it's a couple-portal-only surface, and the hint doesn't say so. A venue who picks a bold Secondary color, saves, and then looks at their own app would reasonably conclude nothing happened. **This is the exact confusion the brief named in advance, confirmed still present.** **P1.**

### Journey 2 — Create a lead

**(Live)** Leads live exactly where the sidebar says (Sales → Leads), the list and Pipeline board are both reachable, and lead cards show name, event type, and date in plain language. Confirmed understandable without training.

**Does the venue understand a stage change can trigger an Automation?** **(Live)** No visible cue anywhere on the Pipeline board itself. **P0 — see Trust/Safety.**

### Journey 3 — Configure Pipeline

**(Live)** The board itself ("Drag a lead to move it to a different stage," colored stage columns with live dollar totals) is genuinely self-explanatory — a venue would understand this is their sales process without being told. The editor (Pipeline Templates, reached correctly from Sales → Leads → "Pipeline Templates," never promoted to Library or a top-level nav item, confirmed exactly matching the intended architecture) lets a venue name and order stages freely.

**The one real problem:** the editor's own header text reads, live, today: *"Reusable, stage-by-stage pipelines you can build and customize. **Not connected to Leads yet — this is just the editor.**"* This is demonstrably false — the very next screen (the live Pipeline board) is powered by this exact template. **This is the single highest-confidence finding in this entire audit.** Confirmed by driving both screens in the same session: the board reads real stages, real colors, and real leads directly from this "not connected" editor. **P0 — Terminology/documentation problem with trust consequences, not a functionality gap.** The fix is two sentences of copy, not a feature.

Per the brief's own instruction, this audit does not evaluate whether Pipeline needs more functionality — it doesn't; what exists already works and is well-designed.

### Journey 4 — Create an Automation

**(Live)** This is the strongest single screen found in this audit. The "New Automation" editor reads: *"Build a set of steps that send automatically, in order, from your Templates. Choose what starts it, then add steps... Changes apply to new enrollments only,"* repeated once more in a highlighted note box. The "Starts when…" dropdown defaults to "Manual only — I'll enroll people myself," a safe, unintimidating default. Opening it reveals exactly three top-level choices (Manual / A new inquiry comes in / A lead reaches a pipeline stage) — not a technical trigger-type enum. Selecting the pipeline option reveals **all seven** canonical stages, each showing the venue's *own* stage name alongside the system meaning: *"New · New Lead," "Won · Booked,"* etc. — confirmed live, this is exactly the fix this engagement's own prior Automation document recommended, already shipped.

**One precise, confirmed edge case:** two of the seven options — *"Contacted · Tour Scheduled"* and *"Qualified · Tour Scheduled"* — show the **identical** venue-facing label. This particular venue's pipeline maps two different underlying system stages to one visible column, which is a legitimate, common choice — but it means a venue picking between these two options must understand the difference between "Contacted" and "Qualified" (raw internal words) to choose correctly, exactly the kind of jargon the "· venue label" bridge exists to avoid. **P1 — narrow, but real.**

Do I feel safe turning an Automation on? **(Live)** Yes, for the Automation editor itself — the "new enrollments only" safeguard is stated twice and is genuinely reassuring. The safety gap is not in this screen; it's in the Pipeline board not warning that a drag can trigger one of these (see Trust/Safety).

Lost vs. Cancelled vs. Booked: **(Live)** confirmed distinct, plain-language options in the trigger picker ("Won · Booked," "Lost," "Cancelled" as separate choices) — understandable without explanation.

### Journey 5 — Client relationship

**(Live)** Clients and Vendors are correctly distinct, both reached from the Clients section. A real client workspace (Emma & Jordan's Wedding) is genuinely excellent: date range, guest count, and an **"Event Readiness"** panel showing exactly which sub-areas need attention, in plain language ("Planning — 6 of 9 required tasks done · 2 overdue," "Floor Plans — 2 inventory items over-allocated," "Payments — $4,319.57 balance due"), each tagged **Needs Attention / Waiting / Not Started / Complete**. This is one of the best single screens in the product — a venue would understand exactly what to do next without training. **Do Not Touch.**

**One small, confirmed inconsistency:** the breadcrumb above a client's name reads *"← Bookings,"* while the sidebar item that led there is labeled *"Clients."* **P2 — terminology.**

### Journey 6 — Contract

**(Live)** A real, in-progress contract shows exactly the venue-first model the brief describes, and it communicates its own state clearly without jargon: a **Signatures** section reading *"Venue — Awaiting venue signature"* and *"Client — Not yet released."* This second line does real comprehension work — a venue reading it understands, without being told directly, that the client can't see this yet *because* the venue hasn't signed. The action buttons are unambiguous ("Sign contract" as the one live, colored call to action; nothing offering to send to the client is visible until after signing). A nervous venue owner would feel safe here — there is no way to accidentally release an unsigned contract from what's visible on this screen. **(Not verified beyond this state** — actually signing would mutate a real record in this account, which this discovery-only audit does not do; the post-signature and release screens were not walked live.)

### Journey 7 — Payments

**(Code + Live list views)** Confirmed, per this engagement's own architecture, a clean three-way split: Packages (Library, a definition), Payment Schedules (Library, a starter preset — its own code comment explicitly states *"not a second DB template system"*), and Payments (the live, per-client schedule, `/payments`, "Track deposits, installments, and outstanding balances"). This matches the definition-vs-live pattern found everywhere else in the product and, per the earlier Financials audit in this engagement, is already correctly labeled. Not re-walked in exhaustive depth here since it was not flagged as a new area of concern in this brief and no new evidence contradicts the prior finding.

### Journey 8 — Tasks / Requests

**(Live)** Task Center's own page copy: *"Your live event workspace — overdue tasks, due today, due this week, and blocked items across all events."* Requests exists as a visibly separate, adjacent destination. The distinction ("what I owe" vs. "what I'm waiting on") is not stated in a single sentence anywhere in the UI itself — a venue would learn it by using both, not by being told directly. Not confusing on first use, but also not self-teaching. **P2.**

### Journey 9 — Library

Tested against every scenario the brief specifies, using the real Library page's real card grid:

| Question | Where a new venue owner would click | Obvious? |
|---|---|---|
| "I want to create the packages I sell." | Pricing & Packages → Packages | Yes |
| "I want to create the questionnaire I send to couples." | Agreements → Questionnaires & Feedback | Yes |
| "I want to edit the contract wording." | Agreements → Contract Templates | Yes |
| "I want to create a reusable follow-up message." | Communication → Message Templates | Yes |
| "I want to create the timeline we use." | Planning → Timeline Templates | Yes |
| "I want to create a floor plan template." | Planning → Floor Plan Templates | Yes |
| "I want to save/reuse a report." | Reports → Saved Reports | Yes |
| "I want to archive something." | Inside the specific asset's own edit screen (the standardized ••• menu) | Yes, once inside — not predictable purely from the Library home grid, but that's correct: archiving is an action on a *specific* thing, not a Library-level concept |
| "I want to find something I archived." | Inside that same asset type's list, per the standardized archived/active separation | Yes, consistent across families |

**Verdict: every real question resolves in one click to the right group, zero ambiguity found.** No reorganization recommended, consistent with the brief's own instruction.

---

## Pipeline

Covered in full under Journey 2/3 above. Summary: the mechanism is excellent and live-confirmed working; the one page describing it to a venue actively contradicts what the rest of the product demonstrably does. Fix the copy, not the architecture.

## Automations

Covered in full under Journey 4 above. Summary: the strongest screen in the audit, with one narrow, real edge case (duplicate venue-facing stage labels) and one cross-cutting safety gap shared with Pipeline (see Trust/Safety).

## Clients / Vendors

Covered under Journey 5. Confirmed distinct, correctly placed, no confusion found.

## Contracts

Covered under Journey 6. The venue-first state model communicates itself clearly in plain language at every state actually observed.

## Financials

Covered under Journey 7. No new concerns found beyond what this engagement's prior Financials work already established as correct.

## Tasks / Requests

Covered under Journey 8. Functionally clear; the conceptual distinction is learned by use, not taught up front — acceptable, not ideal.

---

## Library IA Verdict

Directly answering the brief's specific questions:

- **Is the current six-group Library understandable?** Yes, confirmed live — the page's own opening sentence plus each card's plain-language description does the necessary teaching work.
- **Which, if any, categories cause real confusion?** None found in this walkthrough.
- **Is Inventory in Pricing & Packages understandable?** Yes — its own card description ("What your venue provides — customize examples, then use them on events") makes the placement self-explanatory.
- **Is Saved Reports in Library understandable?** Yes, and it reads correctly as "reports I've chosen to keep," not "all reporting," which is the right distinction from the Reports nav item.
- **Is Communication with only Message Templates acceptable?** Yes — a single-item group is not confusing when the group label and the item are both self-evident; there is no expectation of more items simply because other groups have several.
- **Is the removal of Venue Guide from Library correct?** Yes — confirmed, Venue Guide now lives only under Your Venue, with no remaining Library card found in this walkthrough. No duplicate-meaning confusion remains.
- **Is Pipeline correctly discoverable from Leads?** Yes, confirmed live — "Pipeline Templates" is one click from the Pipeline board's own header, exactly where a venue would look while already thinking about their sales process.
- **Are there any remaining duplicate concepts?** None found. The one near-duplicate risk (Automations both keyed to "a new inquiry comes in") is not a Library concern and is addressed separately above.
- **Should we change anything now?** No changes recommended to Library's structure.
- **What should wait until actual customer testing?** Whether "Library" as a word is the single best possible name is a legitimate open question, but not one this audit's evidence can resolve better than real usage data — leave it exactly as-is until real venues demonstrate a problem, per the brief's own instruction not to reorganize on theoretical grounds.

---

## Event / Client Workspace

Confirmed strong, per Journey 5. "Everything about THIS relationship" is unambiguous — a single page, a clear header (couple's names, date range), an Event Readiness summary answering "what needs my attention," and a consistent tab row for everything else. No duplicated information, no dead ends, and no case found in this walkthrough where a venue would need to remember where something lives — the Overview tab's Event Readiness panel already points at every sub-area that needs a decision.

---

## Help & Guides

**(Live)** The destination itself: well-placed, well-named, one click from Overview, correctly distinct from Venue Guide in both name and content (confirmed: Help & Guides teaches the product; Venue Guide, per its own settings copy, is the venue's own client-facing reference content — no blur found).

**Testing "I'm confused":** a venue can find the destination immediately. Once there, category names are plain ("Finding & Booking Clients," "Working With Clients," "Contracts & Payments") and the five real articles that exist have clear, specific, task-shaped titles ("Turning a Lead into a Signed Client," "Getting Paid, On Time," "Inviting Your First Couple to Their Portal"). A venue could tell at a glance whether one of these five answers their question. **The problem is coverage, not clarity** — seven of twelve categories, including the one most likely to be opened first (Getting Started), show only *"Guides for this area are coming soon."*

**Does the absence of search become a problem already?** No — with five real articles total, browsing the category list is faster than typing a search query would be. **Do not build search yet**, consistent with the brief's own explicit instruction; revisit once article count grows well past what a glance can cover.

---

## Luv

**Where Luv currently appears, confirmed by tracing actual consumers, not assuming from file names:**

| Surface | What it is | Confirmed how |
|---|---|---|
| Venue Dashboard | One small card, "💗 Luv," at most one observation + one recommendation, renders nothing if empty | `app/(app)/dashboard/page.tsx`, read in full, plus own explanatory comment |
| First-visit intro | One dismissible card, one line of copy, marked seen permanently once dismissed | `components/dashboard/luv-intro.tsx` |
| Lead detail page | A "Luv" action surface exists (`luv-actions.ts`) | Not walked live in this pass; confirmed present in code only |
| Settings | A real, clearly-labeled settings section: toggle Dashboard observations on/off, toggle drafting assistance on/off, choose autonomy level ("Suggest only" / "Draft for review"), choose tone (Warm & friendly / Professional / Formal) | `lib/luv/settings.ts` + `components/settings/luv-settings-section.tsx`, both read in full |

**Correcting a real risk of over-reading the code:** a much larger, multi-section `LuvWidget` component exists in the codebase (`components/dashboard/luv-widget.tsx`, with up to eight possible stacked sections) — but tracing its actual import shows it is used **only in the Couple Portal**, not the venue-side Dashboard. It would be a mistake to flag this as evidence of "Luv dominating the venue Dashboard" — she doesn't, there, confirmed by checking the only real consumer.

**Does an opt-out/minimize control already exist?** **Yes — confirmed, contrary to the brief's own uncertainty about this.** `observationsEnabled: false` is a real, saved, per-venue setting, clearly labeled *"Show 'What Luv noticed today' on the dashboard"* in Settings. **One small, confirmed inconsistency:** the real Dashboard card's actual title is *"💗 Luv,"* not *"What Luv noticed today"* — that exact phrase belongs to the Couple Portal's widget, not this one. The Settings description is describing the wrong surface's title. **P2 — terminology/copy accuracy.**

**Where she is genuinely useful:** the existing Dashboard card and first-visit intro are correctly scoped and should not be expanded without a specific, evidenced moment (see "Where Luv Should Help," below).

**Where she would be annoying:** anywhere she isn't currently — confirmed she does not appear on the Pipeline board, the Automation editor, or the Contract signing screen. This restraint is correct and should be preserved, especially given the Pipeline/Automation trust gap named above would be the more tempting place to bolt on a Luv warning; the better fix there is a plain, non-Luv confirmation dialog (see Trust/Safety), not a new Luv moment.

---

## Product Language

| Term | Where seen | Class | Note |
|---|---|---|---|
| Pipeline | Sidebar, Leads | A | Already explained by the board itself |
| Automation | Sidebar, Communication | A | Confirmed self-explanatory via its own page copy |
| Enrollment | Not shown to venues anywhere found live | A | Never surfaced as a word — the UI says "enrolled," in context, which is fine |
| Sequence | Not shown to venues anywhere | A | Correctly internal-only, per this engagement's own prior Automation recommendation |
| Template | Library, everywhere | A | Well understood in context |
| Playbook | Not encountered as a raw word on any screen walked; the Library card is titled "Planning Templates" | A | Confirmed the venue-facing label already avoids the internal term |
| Event Order | Library card | B | Understandable once seen in context ("reusable starting points for the Event Orders you create"), but the term itself isn't self-defining out of context — a brief in-article explanation would help, not a rename |
| BEO | Not found on any venue-facing screen in this walkthrough | A | Confirmed not exposed — correctly avoided |
| Payment Schedule | Financials, Library | A | Clear |
| Finalize | Not encountered live in this walkthrough | Unable to verify from the current evidence | Not observed directly; do not infer |
| Archive / Restore | Library ••• menu | A | Standard, understood words, correctly applied |
| Release | Contract screen ("Not yet released") | A | Confirmed genuinely effective — does real comprehension work without jargon |
| Withdraw | Not encountered live in this walkthrough | Unable to verify from the current evidence | Not observed directly |
| Locked | Not encountered live in this walkthrough | Unable to verify from the current evidence | Not observed directly |
| Published / Draft | Contract status badge ("Draft") | A | Clear, standard |
| Active / Completed / Exited | Automation status badges ("Active," and per code, "Completed," "Stopped — replied," "Stopped — booked") | A | The "Stopped — [reason]" phrasing is a strong, plain-language choice — better than a raw "Exited" would have been |
| Bookings vs. Clients | Breadcrumb says "Bookings," sidebar says "Clients" | D | The one confirmed, genuine terminology inconsistency in this audit — same list, two different names depending on where you're standing |

---

## Trust / Safety

**The one real gap found in this entire audit, and the most important finding in this document besides the Pipeline copy:** dragging a lead card between Pipeline stages can enroll that lead in a live Automation and send a real message — confirmed architecturally (the drag calls the same status-change path that fires `lead_stage_changed`, which this engagement's own Automation work confirmed already enrolls and sends) — **with zero visible confirmation, warning, or even a toast at the moment of the drag.** A venue reorganizing their board for their own clarity, or testing what a stage looks like, has no signal that a real customer-facing action might have just occurred. This is precisely the scenario Hello to Cheers's own stated principle — "never silently change an agreement" — exists to prevent, applied one level earlier: **never silently trigger a customer-facing action from what looks like a private organizational move.** **P0.**

Every other consequential action walked live in this audit **did** communicate itself with appropriate weight: the Contract screen's plain-language state ("Not yet released"), the Automation editor's repeated "new enrollments only" note, and the standardized Library archive/restore pattern all give a nervous venue owner real, confirmed reason to feel safe. This is a narrow, specific gap, not a systemic one.

**A genuine bug found incidentally, not a comprehension issue:** clicking what looked like a Luv indicator on the Settings page revealed a real Next.js hydration-mismatch error — server-rendered an absolute URL (`http://localhost:3000/book/…`), client-rendered a relative one (`/book/…`), for what appears to be a booking-link display. Confirmed via the framework's own dev-mode overlay, not inferred. This is invisible in production (the overlay is dev-only) but suggests a real, live rendering inconsistency worth a developer's five-minute look. **P1 — flagged for verification, not investigated further here since it falls outside this audit's UX scope.**

---

## Progressive Disclosure

The overall balance is good and should not be broadly changed. Confirmed strong examples: the Dashboard's three self-explaining cards instead of a wall of widgets; the Automation editor's three-choice trigger picker instead of a raw trigger-type dropdown; the Event Readiness panel surfacing only what needs attention rather than every field on the event. The one place this audit found the balance tipped toward *too little* disclosure at the wrong moment is the Pipeline board itself — a venue dragging a card into a stage that has a live Automation attached needs *more* signal at that exact moment, not less (see Trust/Safety). No other surface walked in this audit showed either overload or under-explanation.

---

## "If Jennifer Were Not Here"

The ten things most likely to make a real, unassisted venue owner reach for a human.

1. **Reading "Not connected to Leads yet" on their own working Pipeline Templates page.**
   *Trying to:* Set up or trust their sales process. *Gets stuck:* Believes a working feature is broken. *Why:* Stale copy left over from an earlier build phase. *Class:* Terminology/documentation. *Fix:* Update two sentences of page copy. *Handled by:* Neither Luv nor Help & Guides — this is a direct product-copy fix.

2. **Dragging a lead and unknowingly sending them a message.**
   *Trying to:* Reorganize or explore their Pipeline board. *Gets stuck:* Discovers later (or never) that a real customer got a message. *Why:* No confirmation at the moment of a stage change that has an attached Automation. *Class:* UX/trust. *Fix:* A lightweight, dismissible confirmation the first time a drag would enroll someone, or a small badge on stages that have an active Automation attached. *Handled by:* A plain UI confirmation, not Luv — this needs to be reliable, not friendly.

3. **Opening Help & Guides for the first time and landing on "Getting Started — coming soon."**
   *Trying to:* Get oriented. *Gets stuck:* The most likely first click is empty. *Why:* Content sequencing — Phase 1 shipped the shell, not this category's content. *Class:* Product/content gap. *Fix:* Write the Getting Started category first, ahead of anything else. *Handled by:* Help & Guides.

4. **Setting brand colors and not seeing them anywhere in their own daily interface.**
   *Trying to:* Make the product feel like their venue. *Gets stuck:* Picks Secondary/Accent, sees no visible change where they're looking. *Why:* Those colors are used almost exclusively in the Couple Portal and Contract, not the venue's own app; the setup hint doesn't say so. *Class:* UX exposed as terminology — the underlying scope was a deliberate, previously-certified product decision, not a new gap. *Fix:* One clarifying sentence at the Brand step ("these colors are what your couples see — your own dashboard stays Hello to Cheers styled"). *Handled by:* Microcopy, possibly a one-line Help & Guides note.

5. **Two Automations both firing on "a new inquiry comes in" with no visible link between them.**
   *Trying to:* Understand what happens to a brand-new lead. *Gets stuck:* Isn't sure if both will run, or which takes priority. *Why:* The list view doesn't show overlap. *Class:* UX polish. *Fix:* A small note when two active Automations share a trigger. *Handled by:* UI, not Luv.

6. **Picking between "Contacted · Tour Scheduled" and "Qualified · Tour Scheduled."**
   *Trying to:* Build an Automation trigger. *Gets stuck:* Both show the same venue-facing label. *Why:* Their own pipeline maps two system stages to one visible column. *Class:* Terminology, narrow edge case. *Fix:* A small secondary hint distinguishing them (e.g., order of appearance in their own board) *Handled by:* UI copy.

7. **Not knowing whether Task Center or Requests is where a given "thing" belongs.**
   *Trying to:* Track a to-do. *Gets stuck:* Learns the distinction only by trial. *Why:* No single sentence states "Task Center is what you owe, Requests is what you're waiting on." *Class:* Terminology/microcopy. *Fix:* One clarifying line on either page. *Handled by:* Microcopy, or a short Help & Guides article.

8. **Seeing "Bookings" in a breadcrumb after clicking "Clients" in the sidebar.**
   *Trying to:* Navigate back to their client list. *Gets stuck:* Briefly wonders if they're in the same place. *Why:* Two different labels for one list. *Class:* Terminology. *Fix:* One-word breadcrumb change. *Handled by:* Copy fix.

9. **Not understanding what determines whether an Automation can trigger off a Pipeline stage.**
   *Trying to:* Build a custom pipeline that also drives automation. *Gets stuck:* No visible link, while editing a stage, to the fact that its "system meaning" is what an Automation trigger will key off. *Why:* The Pipeline Templates editor doesn't explain this connection anywhere. *Class:* Progressive disclosure gap. *Fix:* A short line in the stage editor. *Handled by:* UI copy, possibly reinforced by Help & Guides.

10. **Wondering what happens to an Automation-enrolled person who then books, replies, or is marked Lost.**
    *Trying to:* Trust that Automations won't embarrass them. *Gets stuck:* No visible statement of the rule, even though — per this engagement's own recent Automation P0 work — the underlying behavior is now correct (booking/loss/reply all stop active enrollments). *Why:* The correct behavior isn't stated anywhere a venue would see it before they need to trust it. *Class:* Documentation, not a product gap — the mechanism is already right. *Fix:* One reassuring sentence, ideally right in the Automation editor near "new enrollments only." *Handled by:* UI copy, or Help & Guides.

---

## Where Luv Should Help

Conservative, per the brief's own instruction.

| Moment | User problem | Luv behavior | Help & Guides? | Silent? |
|---|---|---|---|---|
| First Pipeline Template created | Doesn't know what to do next | "Want a hand adding a simple follow-up after a tour?" → links to Automation editor | Yes, linked from the suggestion | No — one-time, dismissible |
| First Automation created and saved | Uncertain whether it's really safe to turn on | Small, one-line reassurance near the save confirmation, not a new Luv surface | Yes, could link to a short article | Silent by default; only appears once |
| A lead sits in one stage far longer than its neighbors | Doesn't notice a stalled relationship | Existing Dashboard "Luv noticed" card, once real stage-duration history exists (named as a dependency in this engagement's own Pipeline document — not built yet) | No | Yes, until she has something real to say |
| First Floor Plan built | Unfamiliar tool, easy to feel lost | "Want a hand with this?" — one dismiss, never repeats for the same venue | Yes — this is also the audit's own top icon-literacy concern from earlier work | Yes after first dismissal |
| First brand-color save | Colors saved, no visible change nearby | A short, factual note (not necessarily Luv-voiced) explaining where colors do and don't appear | Yes | N/A — this is arguably better as plain UI copy than a Luv moment |
| Every other surface walked in this audit | — | No new Luv presence recommended | — | Silent |

---

## Help & Guides P0 Content

Ranked by the friction actually observed in this walkthrough, not by theoretical completeness.

| # | Title | User question | One-sentence answer | Area | Priority | Contextual entry? |
|---|---|---|---|---|---|---|
| 1 | Getting Started: Your First Morning | "I just logged in — what do I do first?" | Check your Dashboard, then your Leads — everything else can wait. | Getting Started | P0 | From Dashboard, first-visit only |
| 2 | How Your Pipeline Works | "What is this board, and is it really working?" | It's your sales process, fully working — drag any lead to move them forward. | Getting Started / Pipeline | P0 | From the Pipeline board header |
| 3 | Pipeline Stages and Automations, Explained | "Does moving a lead actually do anything?" | Yes — if you've set up an Automation for that stage, it can send a message automatically. | Pipeline / Automations | P0 | From the Pipeline board and the stage editor |
| 4 | What Happens When Someone Books, Replies, or Is Marked Lost | "Will an Automation embarrass me by messaging someone who already said no?" | No — Hello to Cheers automatically stops any active Automation the moment someone books, replies, or is marked Lost. | Automations | P0 | From the Automation editor, near "new enrollments only" |
| 5 | Where Your Brand Colors Actually Appear | "I picked colors — where do I see them?" | Mostly on what your couples see — your contract, your portal, and your emails to them; your own dashboard stays in Hello to Cheers's own look. | Your Venue / Setup | P0 | From the Brand step |
| 6 | Task Center vs. Requests | "Which list is 'my' work?" | Task Center is what you owe; Requests is what you're waiting on from someone else. | Working With Clients | P1 | From both pages |
| 7 | Sending Your First Contract | "How do I get a contract signed?" | You sign first, then release it — the couple can't see it until you do. | Contracts & Payments | P1 | From the Contracts list |
| 8 | Understanding Contract Status | "What does 'Not yet released' mean?" | It means the couple hasn't been sent the contract yet — nothing goes out until you release it. | Contracts & Payments | P1 | From a contract's own status area |
| 9 | Packages vs. Payment Schedules vs. Payments | "What's the difference between these three things?" | Packages and Payment Schedules are things you define once; Payments is what's actually happening on a real booking. | Contracts & Payments | P1 | From Library's Pricing & Packages group |
| 10 | What Does This Floor Plan Icon Mean? | "What do these tools do?" | A short, icon-by-icon reference for the floor plan editor's controls. | Building the Event | P1 | From the Floor Plan editor toolbar |
| 11 | Your First Automation, Step by Step | "How do I actually build one?" | Pick what starts it, add a message, and you're done — you can always add more steps later. | Automations | P1 | From the empty Automations list |
| 12 | Archiving and Restoring in Library | "I archived something — where did it go?" | It's still there — every list separates active from archived, and restoring takes one click. | Library | P2 | From any Library list's ••• menu |
| 13 | Reading Your Client's Event Readiness | "What does 'Needs Attention' mean on this page?" | It's Hello to Cheers telling you exactly what still needs a decision for this one wedding. | Working With Clients | P2 | From the Event Readiness panel |

---

## Do Not Touch

Confirmed, on live and code evidence, as already working well and not warranting disturbance for polish alone:

- **Global navigation** — the eight-section sidebar reads as plain business language throughout; confirmed live, no jargon found anywhere in a top-level label.
- **Library's structure and interaction model** — the standardized card grammar, plain-language descriptions, and the archive/restore pattern all confirmed working exactly as intended; every real-world question tested resolved in one click.
- **Pipeline's underlying architecture** — the board, drag-and-drop, canonical/venue-label mapping, and dollar-value rollups are all confirmed live and correct. Only the one page of copy describing it needs a fix; the mechanism itself does not.
- **Automation P0 architecture** — the trigger picker, the "new enrollments only" safeguard, and the plain-language status labels ("Stopped — replied," "Stopped — booked") are all confirmed live, well-designed, and should not be redesigned. The one gap (silent trigger on drag) is additive — a confirmation step — not a redesign.
- **Contract signing screen's state communication** — "Awaiting venue signature" / "Not yet released" does real comprehension work without jargon; confirmed live.
- **The Event/Client workspace and its Event Readiness panel** — the strongest single screen found in this audit; confirmed live, no changes recommended.
- **Luv's current restraint** — one small card, at most one observation, renders nothing when she has nothing to say, plus a real, clearly-labeled, working opt-out in Settings. This is exactly the target the brief described. Do not expand her surface area without a specific, evidenced moment.
- **Starter protection and archive/release safety** — confirmed via the standardized Library interaction model; not re-tested exhaustively in this pass since no new evidence contradicted this engagement's own prior certification of it.

---

## Prioritized Findings

**P0 — Release/trust blockers**

1. Pipeline Templates page tells the venue their working pipeline "is not connected to Leads yet."
2. Dragging a lead between Pipeline stages can silently trigger a real, customer-facing Automation with no confirmation.
3. Help & Guides' "Getting Started" category — the most likely first click — is empty.

**P1 — Major customer friction**

4. Brand-color setup hints imply colors will appear in the venue's own interface; in practice they mostly don't.
5. Two Automations can silently share one trigger with no visible signal.
6. Two canonical Pipeline stages can share one venue-facing label in the trigger picker, forcing raw internal-word disambiguation.
7. A real hydration-mismatch bug on a booking-link component, found incidentally, unverified in production.
8. No in-product statement that booking/reply/loss automatically stop an active Automation, even though the underlying behavior is already correct.
9. Pipeline stage editor doesn't explain that a stage's system meaning is what an Automation trigger keys off.

**P2 — Polish**

10. Dashboard's Morning Briefing and Today's Attention show identical content back to back (at least in this seeded account).
11. Breadcrumb says "Bookings" where the sidebar says "Clients."
12. Luv Settings' description of the Dashboard card doesn't match its actual live title.
13. Task Center vs. Requests distinction is learned by use, not stated up front.

**P3 — Future ideas**

14. Whether "Library" is the single best possible word — leave to real customer testing, not this audit.
15. Search inside Help & Guides — correctly not needed yet at five articles.

---

## Recommended Next Workstream

A small, bounded pass covering only the P0s and P1s above — almost entirely copy and one confirmation-dialog addition, not a redesign. This should be scoped and sent to Cursor as its own narrow ticket once reviewed, separate from any of this engagement's larger architecture workstreams. No implementation was started in producing this document, per the stop condition.

---

## Evidence / Validation

- **Live, driven in a real browser session:** Dashboard, Leads list, Pipeline board, Pipeline Templates editor (including the "not connected" copy), Automations list, New Automation editor (including opening the trigger dropdown and the stage sub-picker to enumerate all seven real options), Library home and seven sub-pages, Help & Guides home, Settings (venue information section), a real Contract detail page in the venue-first signing state, a real Client/Event workspace (Emma & Jordan's Wedding), Clients list, Vendors list, Invoices list, Payments list, Task Center, Requests. Screenshots were visually inspected, not only text-extracted.
- **Code, read in full where a live click would have required mutating real data or where exact copy needed source-level confirmation:** `lib/luv/settings.ts`, `components/settings/luv-settings-section.tsx`, `components/dashboard/luv-widget.tsx` and its actual import graph, `app/(app)/dashboard/page.tsx`, `components/dashboard/luv-intro.tsx`, `components/shell/user-menu.tsx`, `components/shell/notification-bell.tsx`.
- **Reused from this engagement's own prior, directly relevant certification rather than re-verified from scratch:** the quantified branding-color-usage counts (Primary 110×, Secondary 5×, Accent 19×, Neutral 6×) from `docs/venue-white-label-collateral-certification.md`, since the brief's own framing treats that finding as established context, not a new question.
- **Explicitly not verified, and not inferred:** the post-signature and client-release contract screens (would have required mutating a live record); "Finalize," "Withdraw," and "Locked" as venue-facing terms (not encountered on any screen walked in this pass); whether the hydration-mismatch bug found in dev mode is also observable in production.
- **Test-fixture data, identified and excluded from findings:** lead names ("P0Lost Validation," "P0Canc Validation," "P0Ord Validation") and Automation names ("Po Cancelled Goodbye," "Po Lost Goodbye," "Po Proposal Nudge") in the seeded dev account are QA artifacts, not product copy, and were not treated as evidence of anything beyond confirming the UI renders arbitrary content without breaking.

This document ends here. No code, navigation, copy, Help & Guides content, or Luv behavior was changed in producing it.
