# Calendar — Experience Completion

**Status:** Architecture only, as instructed. No code, schema, or existing Calendar functionality is changed by this document.
**Read first:** `docs/calendar-platform-integration.md`, `docs/scheduling-release-readiness.md` (the user asked for `docs/calendar-release-readiness.md`, which does not exist in this repository — confirmed directly; the actual completed Calendar release-readiness pass is `docs/scheduling-release-readiness.md`, read in its place), `docs/platform-orchestration-architecture.md`. No dedicated `docs/event-readiness-*.md` exists (confirmed, same as every prior audit this program) — Event Readiness's contract is read directly from `lib/readiness/`. `docs/luv-platform-reconciliation.md` and `docs/luv-platform-intelligence-architecture.md`, both read in full.
**Grounded in the live implementation, not assumption:** `lib/calendar/types.ts`, `lib/calendar/service.ts`, `components/calendar/use-calendar-filters.ts`, `components/calendar/calendar-shared.tsx`, `components/calendar/calendar-view.tsx`, and the live database schema for every table `getCalendarData` reads.
**Explicit constraint, honored throughout:** the data model is complete, the aggregation model is correct, the integration model is correct. Nothing below proposes a new table for Calendar's own aggregation, a new event type beyond what's named as a real gap, or a change to how `getCalendarData` composes its seven source queries. Where a genuinely new mechanism is recommended (Saved Views, a staff-identity resolver), it's named as new and scoped as small as the job allows — never presented as "no change" when it isn't.

---

## 1. UX Findings

### The core finding, stated in the terms the task frames it

Calendar today answers *what is happening*. Every mechanism it has — Month/Week/Day/Agenda, the type-filter chip bar, the staff/space dropdowns — organizes the same flat list of `CalendarItem`s by *when*, never by *why a coordinator opened Calendar in the first place*. A coordinator planning their sales day, running a wedding, or checking what's overdue financially all get the identical experience: everything, in date order, until they manually narrow it.

### A concrete instance of the problem, verified directly

`components/calendar/use-calendar-filters.ts`'s own header comment claims: *"shared by Month/Week/Day/Agenda so a coordinator's filter choices carry across views rather than resetting on every navigation."* This is not what the code does. Each view calls `useCalendarFilters(items, storageKey)` with a **different** `storageKey` — `"month"`, `"week"`, `"day"`, `"agenda"` — so each view's filter state is independently persisted and independently empty on first use. A coordinator who filters Month down to their own tours, then switches to Week to check timing, starts over. This isn't a hypothetical "coordinators have to rebuild filters" — it's confirmed, present, and worse than "once a day": once per view switch, every time.

### What already exists and is exactly right for this phase to build on

- **A clean, three-axis filter engine** (`CalendarFilterState { types, staffId, spaceId }`), pure client-side, already proven across four views. This is the correct foundation — Perspectives (§2) are a layer that *sets* this state intentionally, never a second filtering mechanism.
- **`CalendarItem` already carries the metadata perspectives need**: `eventId`/`clientId` (Calendar Integration Phase 3, so any perspective can group by booking), `assignedToStaffId`/`assignedToName` (Phase 4, so "mine" is answerable), `manualType` (the Calendar Manual Type Redesign, so a manually-scheduled Tour/Consultation/Client Meeting is distinguishable from a plain Blocked Time). No perspective proposed below needs a new column to exist.
- **A real, working URL convention** (`?view=week|day|agenda`, defaulting to month) that already makes every view state shareable and bookmarkable — the same convention Perspectives should extend, not replace.

### What's uneven, and honestly constrains what "My Work"/personalization can promise today

`assignedToStaffId` is populated for exactly one thing: Planning items (`event_tasks.assigned_to_staff_id`, per the type file's own comment — *"Only Planning items... and the wedding-day event item... carry these today"*). Tours have their own, separate `tour_appointments.assigned_to` column — but it's free-text, not a `venue_staff` foreign key, and `getTourCalendarEntries` never selects it at all today, so it doesn't even reach the `CalendarItem`. Manually-scheduled Calendar items (`calendar_blocks` — Consultations, Client Meetings, Walkthroughs, etc.) have no staff-assignment column whatsoever. A "My Tours" or "My Meetings" perspective, if built today exactly as literally requested, would either silently show nothing (technically correct, practically useless) or require guessing from a free-text field. Named here plainly so §5's personalization recommendation is honest about what ships now versus what's a small, additive follow-on.

### No staff-identity resolver exists

Every personalization idea in this brief depends on answering one question first: *which `venue_staff` row is the person looking at this screen, right now?* No function anywhere in this codebase answers it. `current_user_venue_id()` (the SQL helper every RLS policy already uses) resolves the *venue*; nothing resolves the *staff member*. This is not a filtering gap — it's an identity-resolution gap, and it blocks every "My —" perspective equally. §5 names the small, additive fix.

---

## 2. Recommended Operational Perspectives

Determined from what the data model actually supports today, not assumed from the brief's own examples. Each is stated as a `CalendarFilterState` preset (or, where noted, a preset plus one small, non-architectural computation) — never a new aggregation.

| Perspective | What it is | Buildable today, as a pure filter preset? |
|---|---|---|
| **All Activity** | No filter. Today's only state, kept as the baseline every perspective returns to. | Yes — it's the current default. |
| **My Work** | `staffId = <resolved current staff id>`, all types. | Partially. Fully correct for Planning items today; correctly empty (not wrong, just incomplete) for everything else until Tours/manual items carry real staff assignment. Worth shipping now, honestly scoped, with the gap named in the UI copy ("Planning tasks assigned to you") rather than implied to cover everything. |
| **Planning** | `types = [planning_activity, planning_task, timeline_entry, request_due, document_expiration, contract_expiration]` | **Yes, fully — every one of these types already exists.** The cleanest, most complete perspective available today. |
| **Sales** | `types = [tour, follow_up]` today; adding Consultations requires the one small filter-model extension named in §3. | Mostly — Tours and lead follow-ups work now; Consultations need `manualType` filtering, a small additive change, not new architecture. |
| **Finance** | `types = [payment_due, contract_expiration, document_expiration]` | **Yes, fully.** |
| **Wedding Week** | Not a type filter — a *relevance window*: every `event`-type item whose date falls within the next N days (7, matching the threshold `docs/luv-platform-intelligence-architecture.md` §4 already uses for "wedding is in N days"), plus every item sharing that booking's `eventId` (already a passthrough field, no new query). | Yes, but structurally different from the others — see §3's distinction between a pure preset and a preset-plus-relevance-computation. |
| **Wedding Day** | Every `event`-type item whose date is *today*, surfaced as a short list with a direct link into the already-built Wedding Day dashboard (`/events/[id]/today`) — **not** a reimplementation of Timeline/Vendors/Floor Plans/Seating inside Calendar's own grid. | Yes, and this is the one perspective where restraint matters most — see §6. |

**Deliberately not recommended, named honestly:**
- **"Messages"/"Pipeline activity" as Calendar item types** — Communication has no dated fact for Calendar to show (confirmed: `docs/platform-orchestration-architecture.md` §1 lists "Communication replied" as never emitted as a calendar-shaped date, and `docs/luv-platform-reconciliation.md` §3 independently reaches the same conclusion — Communication produces unread *counts*, never a due date). Folding Communication into "Sales" as the brief's own example suggested would mean inventing a scheduled-date concept Communication doesn't have. Not built.
- **A generic "Staff" layer showing every staff member's individual schedule side by side** — real, plausible, but a materially different UI shape (a resource-per-row grid, not a filtered version of the existing four views) — named in Future Considerations, not designed here.

---

## 3. Layering Model

**Decision: layers do not exist as a mechanism separate from Perspectives.** The brief asks this to be determined, not assumed — here is the reasoning.

A "layer" (Business / Operations / Financial / Staff, per the brief's own examples) and a "Perspective" (My Work / Sales / Planning / Finance) describe the same underlying object from two different angles: both are, mechanically, *a named `CalendarFilterState` preset*. Introducing Layers as a second, higher grouping construct — with its own selection state, its own persistence, its own relationship to the filter engine — would mean two systems doing the same job, which is exactly the "Do not duplicate filtering logic" instruction this document is bound by. A coordinator does not experience "Financial layer, then Payments perspective within it" as two decisions; they experience "show me the money stuff" as one.

**What survives from the Layering idea, correctly scoped:** perspectives should be *visually organized* by the same categories the brief names (Operational, Sales, Financial), so a switcher with eight-plus perspectives doesn't read as a flat, undifferentiated list — but that's a presentation grouping in the switcher UI, not a second data mechanism. §3 of the Layering examples becomes a section header inside one perspective picker, not a second picker stacked above it.

**The one real structural distinction worth keeping, because it's true, not because the brief asked for it:** some perspectives (Planning, Finance, Sales, My Work) are pure filter presets — set `CalendarFilterState`, done. Others (Wedding Week, Wedding Day) require one additional, lightweight step: finding which *bookings* are relevant by date, then including every item tied to those bookings by `eventId`. This is still zero new data (every field involved already exists on `CalendarItem`) and zero new backend query (it's a client-side pass over `filteredItems`, the same shape `useCalendarFilters` already produces) — but it's a genuinely different computation shape, and a future implementer should know that going in, rather than discovering it mid-build.

**One small, additive extension `CalendarFilterState` genuinely needs, named because Sales depends on it:** a fourth optional axis, `manualTypes: ManualScheduleType[] | null`, exactly parallel to `types` — filtering `calendar_block` items by their `manualType` (Consultation, Client Meeting, etc.) the same way `types` already filters by `CalendarItemType`. This is not new architecture — it's the same shape as the `staffId`/`spaceId` additions Phase 4 already made to this exact type, applied to a field (`manualType`) that already exists on every relevant item today.

---

## 4. Saved Views Strategy

**Decision: yes, venues should be able to save a Perspective — scoped as narrowly as the brief instructs, not as a report builder.**

A Saved View is, mechanically, nothing more than: *a name, plus the `CalendarFilterState` a coordinator had active when they saved it.* That's the entire object. No query builder, no conditional logic, no cross-venue templates.

**What ships as system-provided, always present, never deletable:** the perspectives in §2. These are the "intelligent defaults" the brief asks for — chosen because every one of them is grounded in a real, already-existing data shape, not invented for variety.

**What a venue can add:** a coordinator, having manually adjusted a perspective's filters (e.g., started from "My Work," added a specific staff-mate to see a shared workload), can save that exact combination under a name of their choosing. This is additive to, never a replacement for, the shipped defaults — a venue's saved views append to the switcher, they don't reorder or hide the system perspectives.

**What this needs that doesn't exist today, named plainly since it's the one place actual new surface area is required:** a small table (illustratively: `calendar_saved_views { id, venue_id, created_by_staff_id, name, filter_state jsonb, created_at }`) and the CRUD to go with it. This is genuinely new — the filters hook's own comment already states no such table exists anywhere in the app. It is also genuinely small: one table, no relationships beyond `venue_id`/`created_by_staff_id`, no new concept the rest of the platform needs to know about. Scoped for a later implementation phase, not built here.

---

## 5. Personalization Strategy

**Decision: yes — "My —" perspectives should personalize automatically, with zero manual filtering required each time, exactly as the brief asks.**

**The one prerequisite, named because nothing here works without it:** a staff-identity resolver. Recommended shape, mirroring the existing `current_user_venue_id()` SQL helper exactly (same pattern, one level more specific):

```sql
current_user_staff_id() → the calling user's own venue_staff.id, or null
```

This is identity resolution, not a new ownership concept — it answers "who is asking," it does not create a new field anything gets assigned *to*. It reuses the exact same `venue_staff.user_id = auth.uid()` relationship `current_user_venue_id()` already reads.

**How "My Work" then resolves, with zero manual steps:** on load, resolve the current staff id once, and set `staffId` to it automatically when the "My Work" perspective is selected — the coordinator never sees a staff picker for their own perspective; `staffId` is simply already correct.

**What "My Tours"/"My Meetings" would need beyond that, named honestly rather than promised:** `tour_appointments.assigned_to` becoming a real `venue_staff` reference (or, as a smaller interim step requiring no schema change, resolving the current staff member's `full_name` and string-matching it against the existing free-text field — a real, if imperfect, way to reuse what exists rather than inventing a new column). Both are legitimate small follow-ons; neither is designed further here, since both are additive to a working "My Work" perspective, not a blocker to shipping one.

---

## 6. Navigation Recommendations

- **Extend, don't replace, the existing `?view=` convention:** add `?perspective=`, e.g. `/calendar?perspective=my-work&view=week`. Every perspective + view combination stays a real, shareable, bookmarkable URL — the same property Month/Week/Day/Agenda already have individually.
- **The perspective switcher becomes the primary toolbar element; the raw filter chips become secondary.** Today the type-filter chip bar is the first thing a coordinator sees and must engage with. Perspectives should occupy that position instead — a small, named set of buttons or a compact dropdown (five to seven items, per §2) — with the existing filter bar demoted to a "Customize" disclosure a coordinator opens only when a perspective needs adjusting. This is the concrete version of "think less like a filter panel, think more like changing perspective."
- **Selecting a perspective visibly sets the underlying filters, never hides them.** A coordinator who opens "Customize" after picking "Sales" should see `types: [tour, follow_up]` already checked, not a blank panel — perspectives configure the filter engine transparently, they don't obscure it. This keeps the "layers enable existing filters, never duplicate them" decision in §3 honest at the UI level, not just the data level.
- **"Wedding Day" is a link out, not a rendering surface.** The perspective's entire job is: find today's `event`-type item(s), and surface a direct link to `/events/[id]/today` (or, with more than one wedding today, a short list of links) — reusing the fully-built Wedding Day dashboard rather than growing a second one inside Calendar. This is the sharpest test of "if a proposed feature does not improve operational focus, it probably does not belong" — rendering vendor check-in state inside Calendar's own grid would not improve focus, it would fragment the one page already built to be the wedding-day source of truth.

---

## 7. Mobile Considerations

- **Perspectives are a bigger mobile win than a desktop one.** Rebuilding a three-axis filter (type chips + staff dropdown + space dropdown) by hand on a phone is real friction the current UI already imposes; a single tap into a named perspective removes it entirely. `docs/scheduling-release-readiness.md` already found Agenda view — the view explicitly "suited to mobile" per its own stated purpose — had zero on-screen navigation before this program's own Scheduling pass added it; the perspective switcher should get the same priority, not be treated as a desktop-first affordance ported down later.
- **The switcher should default to a compact, single-row or bottom-sheet control on narrow viewports** — not the same button-row layout that works at desktop width, since five-to-seven named perspectives plus view controls (Month/Week/Day/Agenda) competing for one toolbar row will not fit a phone screen. Not designed further here (a UI/visual decision, correctly deferred to implementation), named because "mobile considerations" was asked for explicitly and deserves more than "same as desktop, smaller."
- **Wedding Day is the perspective most likely to be opened from a phone, standing at the venue** — worth the switcher treating it as a fast, thumb-reachable default rather than buried in a dropdown, on exactly the days it matters.

---

## Release Recommendation

# Ready to implement

**Justification.** Every perspective recommended in §2 either needs zero new data (Planning, Finance, My Work) or one small, honestly-named additive step already scoped precisely (Sales' `manualTypes` filter axis, Wedding Week's relevance computation, the staff-identity resolver). The layering question the brief asked to be determined has a clear answer — layers and perspectives are the same mechanism, and building both would duplicate the filtering logic this document is explicitly bound not to duplicate. Saved Views has a real, minimal, non-report-builder shape ready to build when prioritized. Nothing here touches `getCalendarData`, the seven-source aggregation, or any of the twelve existing `CalendarItemType`s' underlying ownership — the architecture this document was asked to respect stays exactly as it was.

**What "Ready to implement" does not mean:** this document is not a green light to build everything in §2 at once. The natural order is Planning and Finance first (zero new data, immediately correct), then My Work (needs only the staff-identity resolver), then Sales (needs the `manualTypes` axis), then Wedding Week/Wedding Day (need the relevance-computation pattern, and — for Wedding Day specifically — real care to stay a link-out, not a second dashboard), then Saved Views last, since it's the only piece needing new schema and the one perspectives should prove themselves without it first.
