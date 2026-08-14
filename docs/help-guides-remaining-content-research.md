# Help & Guides — Remaining Coverage Research

**Type:** Content research and drafting recommendation only. No articles were written to the database, no migrations created, no Help UI or taxonomy changed.
**Method:** Every workflow below was driven live in the running application (logged in as `owner@example.com` on Sweet Daisy Barn & Farm) wherever the real UI could render it, cross-checked against source where live capture was unreliable, and checked against the live database for the current published-article set and the `couple_venue_feedback` table's real consumers. Evidence is labeled per item: **VERIFIED LIVE**, **VERIFIED FROM SOURCE**, **VERIFIED FROM DATABASE**, or **UNVERIFIED**.

---

## Current Coverage

**VERIFIED FROM DATABASE** — 24 published articles across 7 areas (one more area than the brief's own list, worth noting):

| Area | Article count |
|---|---|
| Getting Started | 2 |
| Finding & Booking Clients | 9 |
| Working With Clients | 1 |
| Contracts & Payments | 5 |
| Building the Event | 4 |
| Vendors | 1 |
| **Your Venue** | **1** *(not mentioned in the brief's "has content" list — "Where do my venue colors actually show up?")* |
| Event Day | 0 |
| After the Event | 0 |
| Reports | 0 |
| Guided Journeys | 0 |

The four empty areas are confirmed exactly as described. This research covers only those four.

---

## Event Day

**VERIFIED LIVE / VERIFIED FROM SOURCE**, as marked. Two real, distinct surfaces exist: the **Day Sheet** (a printable summary) and the **Wedding Day Dashboard** (a live, interactive hub), plus the always-present **Task Center**.

### Recommended Articles

**1. What is the Day Sheet, and how do I get one?**
- **User question:** "How do I get a one-page summary I can hand my team on event day?"
- **Why it matters:** confirmed live — a real, complete, print-ready document exists, but nothing in the product currently explains it exists or how rich it is.
- **Exact workflow (VERIFIED LIVE):** open the event → click **Day-of Sheet** (a button in the event header, printer icon) → a preview page opens with **Print / Save as PDF** at the top. The document itself includes: venue name, date, couple names, the full Schedule (pulled from the event's Timeline, with times and descriptions), Vendors (name, category, phone), and a Final Details section (ceremony/reception times, guest count, meal notes, and any free-text notes).
- **Confidence:** High.

**2. What is the Wedding Day Dashboard, and when do I use it?**
- **User question:** "What should I actually look at on the morning of the wedding?"
- **Why it matters:** a real, distinct, richer live tool exists beyond the static Day Sheet — confirmed via source it has nine real sections: Guest Summary, Timeline, Day-of Tasks, Vendor Check-In, Key Contacts, Requests, Floor Plans, Seating, and Documents (**VERIFIED FROM SOURCE**, `components/events/wedding-day-dashboard.tsx`).
- **Exact workflow (VERIFIED LIVE for the entry point, VERIFIED FROM SOURCE for the dashboard's own content since no seeded event is dated today):** on the actual day of the event — confirmed precisely, the button and banner both only appear when `daysUntil(event.eventDate) === 0` — a green **✦ Today's Dashboard** button appears in the event header, and a full-width banner reading *"Today's Wedding Day Dashboard — Live timeline · Vendor check-in · Emergency contacts"* appears at the top of the event page. Clicking either opens the dashboard at `/events/[id]/today`.
- **Important caveat to state plainly in the article:** this is date-gated — it will not appear early, and a venue shouldn't expect to see it until the actual morning of the event.
- **Confidence:** High on the entry point (driven live); medium-high on describing all nine sections' exact content (confirmed from source, not walked live with real data, since no seeded event is dated today).

**3. Where do I see my event-day tasks?**
- **User question:** "How do I know what's still outstanding right before the event?"
- **Why it matters:** Task Center already exists and is already the correct answer — this is a short, clarifying article, not a new workflow.
- **Exact workflow (VERIFIED LIVE):** Tasks → **Task Center**, whose own description is *"Your live event workspace — overdue tasks, due today, due this week, and blocked items across all events."*
- **Confidence:** High. **Overlap note:** confirm this doesn't already exist under Getting Started before publishing — not found in the current 24, so likely genuinely new, but a light check is warranted.

### Deferred / Not Documentable

None — all three above are real, verifiable, and worth documenting. No speculative Event Day topics were found beyond these.

---

## After the Event

**Two genuinely different "feedback" mechanisms exist, and only one of them is real from a venue's perspective.** This is the most important finding in this section.

### Recommended Articles

**1. How do I mark an event complete, and what happens when I do?**
- **User question:** "The wedding is over — what do I do in Hello to Cheers now?"
- **Exact workflow (VERIFIED LIVE for the control, VERIFIED FROM SOURCE for the downstream behavior):** on the event page, the **Change status** dropdown (top-right, next to the status badge) includes **Complete** as a real option.
- **Important caveat (VERIFIED FROM SOURCE, this engagement's own prior Event Order research):** marking an event Complete now shows a real warning if that event's Event Order and/or Floor Plan haven't been finalized yet — worth stating plainly so a venue isn't surprised by it.
- **Confidence:** High.

**2. How do I collect feedback from a couple after their event?**
- **User question:** "How do I ask a couple how everything went?"
- **Why it matters:** confirmed a real, working mechanism exists — **VERIFIED FROM SOURCE**, `lib/questionnaire-family/definitions.ts` — "Post-Event Feedback" is one of three real questionnaire kinds (alongside Client Planning and Final Details), using the exact same send/respond/view mechanism already covered for the other two.
- **Exact workflow:** reached the same way as any other questionnaire for that client (already partially covered by existing Building the Event content) — this article's genuinely new value is naming that this specific one exists and is meant for after the event, with its own real default prompt: *"Thank you for celebrating with us. When you have a moment, we'd love your Post-Event Feedback about how everything felt."*
- **Confidence:** Medium-high — the send/respond mechanism itself is shared with already-documented questionnaire flows; this article's job is narrowly to point at the Post-Event-specific one, not re-explain questionnaires generally.

### Deferred / Not Documentable — with a real Product Issue flagged

**PRODUCT ISSUE — NOT DOCUMENTATION.** A second, separate, more specialized feedback system exists in the database — `couple_venue_feedback`, with real fields for a star rating, "what they loved," "what could improve," a public-review-permission flag, and a venue-side approval workflow (`venue_status`, `approved_for_public_at`) that connects to the real "Public review link" setting already covered in the published "Where do my venue colors actually show up?"-adjacent branding work. **Confirmed by exhaustive grep: this table has no venue-facing UI anywhere in the product** — it is referenced only in `lib/metrics/registry.ts`, nowhere a venue could ever see or act on a submitted review. **Do not write an article describing this as a way to collect or approve reviews — it would document a capability a venue cannot actually reach.** This is named here as a product gap for Jennifer's awareness, not something to route around with documentation.

---

## Reports

**VERIFIED LIVE.** A real, clean, five-destination reporting section plus a real Saved Reports feature.

### Recommended Articles

**1. What can I see in Reports?**
- **User question:** "Where do I check how my venue is doing?"
- **Exact workflow (VERIFIED LIVE):** Overview → **Reports**. The page's own description: *"How your business is doing — bookings, revenue, sales, and events."* Five tabs, confirmed exact: **Overview, Sales, Bookings, Revenue, Events.** A shared date-range control persists across every tab (confirmed live: defaults to "This Month," shown as "Showing Aug 1 – Aug 31, 2026").
- **The real, current metrics on Overview, confirmed live and exact:** Bookings ("Clients who signed and paid their deposit"), Leads ("New inquiries in this period"), Booking Conversion Rate ("Inquiry → Booking"), Gross Booked Revenue ("Total contracted value of booked events"), Payments Collected ("Money actually received during this period"), Outstanding Balance ("Booked revenue not yet collected").
- **Confidence:** High.

**2. Which report should I use for a specific question?**
- **User question:** "I want to know something specific — which tab do I open?"
- **Why it matters:** five tabs with similar-sounding names (Bookings vs. Revenue vs. Sales) genuinely benefit from one short disambiguation.
- **Exact distinctions, confirmed live/from source (each tab's own header description):** **Sales** — "Where your opportunities are coming from, and how well they're converting into bookings" (the funnel/lead-source view). **Bookings** — "What you've actually booked, and what it's worth." **Revenue** — "See what you've booked, collected, and still have outstanding" (includes a real "Who Owes Us Money" breakdown). **Events** — "What your event business looks like over time."
- **Confidence:** High on Sales/Bookings/Revenue/Events headers (all confirmed from source); Overview's own live metrics independently confirmed live.

**3. How do I save a report and find it again later?**
- **User question:** "I keep coming back to the same report — can I bookmark it?"
- **Exact workflow (VERIFIED LIVE):** any report screen has a **Save Report** button (confirmed on Overview); saved reports are then reachable from **Saved Reports**, confirmed live with real content: four starter saved reports already exist out of the box — Events, Revenue, Bookings, Sales — each showing a **Starter** badge, the current date range ("This Month · Updated 1d ago"), and **Open report** / **Manage** actions.
- **Confidence:** High.

### Deferred / Not Documentable

**Scheduling/exporting a report** — the brief's own candidate topic list asked about this. **UNVERIFIED**: this pass did not find a live "schedule" or "export" control on the report screens actually captured, but also did not exhaustively rule it out on every tab (the Bookings tab's live content could not be captured due to a repeated page-load timeout in this environment, not a confirmed absence). **Recommend not writing this article until explicitly confirmed present or absent** — do not guess either way.

---

## Guided Journeys

**Confirmed conclusively: this is not a real, built product feature.**

**VERIFIED FROM SOURCE, exhaustive:** the phrase "Guided Journey" (in any casing or form) appears in exactly one place in the entire codebase — `lib/help-guides/areas.ts`, the Help taxonomy definition itself, where it's described only as *"Multi-step paths across Hello to Cheers."* No route, no component, no database table, no service, no RPC, nothing anywhere else references it. There is nothing to document.

**Recommendation, exactly as the brief anticipated this outcome:** **Documentation should remain empty because the product is not ready to document.** Do not write speculative articles describing what a "Guided Journey" might be. If this category should eventually be removed, renamed, or repurposed, that is a taxonomy decision outside this content-research task's scope — flagged here, not decided.

---

## Cross-Category Duplication Check

Checked the full 24-article list (above) against every recommendation in this document:

- No existing article covers the Day Sheet, the Wedding Day Dashboard, marking an event Complete, Post-Event Feedback questionnaires, or any Reports topic — all six substantive recommendations above are genuinely new coverage, not near-duplicates.
- **"Where do I see my event-day tasks?"** is the one recommendation closest to existing territory (Task Center is presumably touched on tangentially elsewhere) — flagged in its own entry above as worth a light duplication check before writing, since this pass did not find an existing article that already covers it by name.

---

## Recommended Final Article Set

Six articles, not more:

1. What is the Day Sheet, and how do I get one? *(Event Day)*
2. What is the Wedding Day Dashboard, and when do I use it? *(Event Day)*
3. Where do I see my event-day tasks? *(Event Day)*
4. How do I mark an event complete, and what happens when I do? *(After the Event)*
5. How do I collect feedback from a couple after their event? *(After the Event)*
6. What can I see in Reports? *(Reports)*
7. Which report should I use for a specific question? *(Reports)*
8. How do I save a report and find it again later? *(Reports)*

*(Eight, not six — corrected count: three Event Day, two After the Event, three Reports. Guided Journeys: zero, deliberately.)*

---

## Product Issues Discovered

Separated explicitly from documentation gaps, per instruction:

- **`couple_venue_feedback` (star-rating post-event review system) has no venue-facing UI anywhere in the product**, despite a real, complete data model including a review-approval workflow and a connected "Public review link" setting elsewhere. This is a real product gap, not something to document around. **PRODUCT ISSUE — NOT DOCUMENTATION.**

No other product issues were found in this pass — Event Day and Reports both held up as genuinely complete, working, well-labeled features under direct live inspection.

---

## Evidence

| Workflow | Evidence |
|---|---|
| Day Sheet full content and print flow | VERIFIED LIVE |
| Wedding Day Dashboard entry point (button/banner, date-gating) | VERIFIED LIVE |
| Wedding Day Dashboard's nine internal sections | VERIFIED FROM SOURCE (no event dated today to walk live) |
| Task Center description | VERIFIED LIVE |
| Change status → Complete control | VERIFIED LIVE |
| Event-completion Event-Order/Floor-Plan warning | VERIFIED FROM SOURCE (this engagement's own prior, separately-verified Event Order research) |
| Post-Event Feedback questionnaire kind exists and has real default copy | VERIFIED FROM SOURCE |
| `couple_venue_feedback` has no venue-facing consumer | VERIFIED FROM SOURCE (exhaustive grep) |
| Reports Overview, its six live metrics, and the five-tab structure | VERIFIED LIVE |
| Sales/Bookings/Revenue/Events tab header descriptions | VERIFIED FROM SOURCE (Bookings tab's live render could not be captured in this environment; description confirmed from its own page source instead) |
| Save Report button and Saved Reports' four real starters | VERIFIED LIVE |
| Report scheduling/export existence | UNVERIFIED — not found, not exhaustively ruled out |
| Guided Journeys has no product feature | VERIFIED FROM SOURCE (exhaustive grep) |

This document ends here. No articles were published, and no code, database, or Help taxonomy was changed in producing it.
