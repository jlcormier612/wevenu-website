# Scheduling Platform — Release Readiness Audit

**Status:** Audit complete. Implementation follows in this same document's own Phase 1/2/3 sections below.
**Read first:** `docs/calendar-platform-integration.md`, `docs/platform-orchestration-architecture.md`, `docs/platform-event-adoption-plan.md`, and every completed Calendar Integration phase (1–4, built earlier this program: Time-Aware Planning, Operational Deadlines, Operational Views, Coordinator Experience). `docs/platform-workspace-architecture.md` does not exist in this repository (confirmed directly, as in every prior architecture document this program). **Important caveat on the source docs:** `docs/calendar-platform-integration.md`'s own §2/§3 tables describe the state *before* Calendar Integration Phases 1–4 were built ("Not yet wired," "No week view," etc.) — this audit verifies current, post-implementation reality against live code, not that document's own historical snapshot.
**Method:** A mix of direct code/schema investigation and one focused research pass (Calendar's own views, verified independently). Every claim below is traceable to a file, line, schema query, or empirical test — including, in several places, correcting my own initial assumptions once the actual schema/code was read rather than guessed at. This audit found the Scheduling domain considerably more mature than its own task brief's example gaps implied; several "missing capability" examples turned out to be real, working, already-shipped features, and are reported as such rather than assumed broken.

---

## Release Blockers

Things preventing real-world scheduling. Both fixed in this pass — see Phase 1.

### 1. Calendar Week/Day → Month/Agenda navigation silently loses the viewed date

Confirmed bug, not a guess. `resolveCalendarView()` (`lib/calendar/view-data.ts`) computes the returned `year`/`month` from URL params that Week and Day's own navigation controls never set (`week-view.tsx`, `day-view.tsx`, and the keyboard shortcut handler in `calendar-view.tsx` all omit `year`/`month` when navigating). `switchView()` (`calendar-view.tsx`) then uses these silently-stale `year`/`month` values when a coordinator switches from Week or Day to Month or Agenda. Concretely: a coordinator reviewing a future week in Week view who clicks "Month" is silently dropped back onto the *actual current* month, not the month they were just looking at — no error, no warning, just wrong. This is exactly the class of "silently incorrect, not obviously broken" bug this program has treated as release-blocking every time it's been found (the multi-event portal session leak, the Seating stat-inflation bugs) — a coordinator has no way to know the view jumped without independently re-checking the date.

### 2. Tour scheduling doesn't enforce the same hard-block conflict rule event creation does

`components/availability/conflict-warning.tsx`'s `ConflictWarning` component supports an `onStatusChange` callback specifically so a parent form can disable its own Save button when a hard conflict (`severity: "error"`, currently only `calendar_blocked`) is present — and `components/events/event-form.tsx` wires this correctly (`disabled={pending || dateBlocked}`). `components/leads/relationship-card.tsx` renders the identical `ConflictWarning` component for tour scheduling but never wires `onStatusChange` at all — a coordinator can schedule a tour on a date the venue has explicitly blocked (maintenance, a private event, a holiday) with only an ignorable advisory banner, even though the underlying conflict-detection logic (`lib/availability/repository.ts`'s `checkAvailability`) already classifies `calendar_blocked` as a hard error identically for both `type: "event"` and `type: "tour"`. This reads as an overlooked wiring gap, not a deliberate design choice — the severity classification was clearly meant to apply equally to both.

---

## UX Improvements

Real, verified gaps that don't prevent scheduling but materially hurt usability. Selected items implemented in Phase 2 — see that section for exactly which.

1. **Room and staff assignment are tracked but never displayed.** `CalendarItem.spaceName`/`assignedToName` (Calendar Integration Phase 4) are real, correctly-populated fields — confirmed via `lib/calendar/service.ts` (the wedding-day `event` item carries `spaceName`) and the `event_tasks.assigned_to_staff_id` FK to `venue_staff` (Planning items carry `assignedToName`). But grepping every item-rendering component (`calendar-shared.tsx`, `week-view.tsx`, `day-view.tsx`, `agenda-view.tsx`) for these two fields returns zero matches — they exist purely as filter metadata, never rendered as visible text on an actual calendar item. A coordinator can *filter* by room or staff member but can't *read* either off an item without opening it. This directly weakens the audit's own "What room? What staff member?" operational test — both are answerable only partially without leaving Calendar today.
2. **Agenda view has no on-screen navigation at all** — confirmed via the Calendar-views investigation: only the document-level keyboard shortcuts (arrow keys) move it forward/back; there are no visible prev/next controls. This is a real usability problem specifically because Agenda's own stated purpose (`docs/calendar-platform-integration.md` §3) is being "suited to mobile" — a view designed for mobile with zero touch-accessible navigation is close to unusable on the device it's meant for.
3. **Week view has no on-screen "Today" button** — only reachable via the `t` keyboard shortcut, inconsistent with Month and Day, which both have one.
4. **No text search exists anywhere on Calendar** — confirmed absent (no search input, no query param, nothing) despite being explicitly named in this audit's own brief. A coordinator can filter by type/space/staff but cannot type a client or booking name to jump to it.
5. **"Saved filters" doesn't deliver what the name implies.** `use-calendar-filters.ts`'s own code comment is explicit and honest about this: filter selections persist to `localStorage` per view (Month/Week/Day/Agenda each remember their own last-used filters across reloads), but there is no named-preset save/reapply capability, no backend table, nothing a coordinator could call "my Tuesday coordinator view" and switch back to on demand. If Phase 4's original scope implied true saved presets, that specific promise was not delivered — only implicit last-state memory was.
6. **Booking Schedule has no discoverability path.** The view exists, works, and is genuinely useful (confirmed: real per-booking data, correct prev/next-booking navigation, correct link back to the event) at `/calendar/booking/{eventId}` — but nothing links to it. Not the Event Detail page, not the Client page, not the Event Readiness card, not the wedding-day dashboard (`today/page.tsx`). A coordinator would have to already know this URL exists.
7. **The wedding-day dashboard has zero integration with Calendar or Booking Schedule.** Confirmed via direct grep: `today/page.tsx`/`wedding-day-dashboard.tsx` contain no reference to either. "Run of Show" (named in this audit's own brief as a fourth surface) is confirmed to be Timeline's own on-page alias, not a separate system — that part is not confusing, just worth naming precisely. The real gap is that a coordinator standing at the venue on the wedding day, using the one page built specifically for that moment, has no link into Calendar's own booking-scoped schedule view.
8. **Self-service tour booking has no self-service reschedule or cancel.** `app/book/[key]/page.tsx` (a real, working, unauthenticated tour-booking widget backed by `book_tour`/`get_tour_slots` SECURITY DEFINER RPCs — confirmed genuinely built, not a stub) only creates new bookings. No route or RPC lets a lead who already booked a tour change or cancel it themselves; that requires contacting the venue.

---

## Platform Gaps

Missing scheduling capabilities, verified as genuinely absent rather than assumed. Several capabilities this audit's own brief listed as possible examples turned out to already exist — reported honestly below rather than treated as gaps to pad the list.

**Confirmed to already exist, well-built, not gaps (stated here so nothing gets re-flagged by a future audit):** business hours (`venue_business_hours`, real schema + real settings UI in `components/settings/venue-settings.tsx` + onboarding wizard steps, actually consulted by `get_tour_slots`'s slot-generation logic); holiday/blackout dates (modeled as `calendar_blocks` with `reason: 'holiday'` and `recurrenceRule: 'annual'` — no separate system needed, a deliberately reused mechanism, not a missing one); tour appointment length (`tourDurationMinutes`, venue-configurable); a buffer concept between tour appointments (`tourBufferMinutes`, factored directly into slot-generation stepping); tour min-notice and max-advance windows (`tourMinNoticeHours`/`tourMaxAdvanceDays`); a real self-service tour-booking workflow (`app/book/[key]`); real, working space/event/tour capacity conflict detection (`lib/availability/`, both hard-block and soft-warning tiers, live-tested against the actual repository code).

**Genuinely absent:**

1. **No distinct "consultation" appointment type.** `tour_appointments` has no type/kind column — every self-service or manually-created appointment is structurally a "tour," regardless of what a venue might want to call a phone consultation or a second visit.
2. **No venue-configurable appointment-type catalog.** A venue cannot define its own appointment types with their own durations/rules beyond the single, hardcoded "tour" concept (`tourDurationMinutes` is one global number, not a per-type list).
3. **No distinct travel buffer vs. preparation buffer.** `tourBufferMinutes` is one undifferentiated number between appointments — there's no way to say "20 minutes to drive between tours" separately from "10 minutes to reset the space."
4. **No staff-conflict detection anywhere.** Confirmed via targeted search across `lib/` — no code path checks whether a staff member (`event_tasks.assigned_to_staff_id`, `tour_appointments.assigned_to`) is already committed to something else at an overlapping time. `tour_appointments.assigned_to` itself is free text, not even an FK to `venue_staff` — a second, weaker identity concept than Planning's own `assigned_to_staff_id`, worth noting as its own small inconsistency.
5. **No Planning-template-level meeting scheduling.** A coordinator *can* schedule any individual task (kickoff, design meeting, tasting, rehearsal, walkthrough, vendor meeting, final meeting) via the existing per-task checkbox-reveal date/time/location UI in `components/playbooks/event-task-list.tsx`, and `category: "meeting"` is a real, already-used category value — so every named meeting type in this audit's brief is genuinely schedulable today, without a workaround. What's missing is template-level automation: a Planning Template's own task definitions carry a due-date offset (`daysOffset`) but no equivalent scheduled-offset, so every meeting must be scheduled manually, per booking, even when applied from a template that already knows a walkthrough should happen two weeks out.
6. **No iCal/calendar-sync export.** Print (real, works) and CSV export (real, works) both exist; there is no `.ics` feed or sync capability for a coordinator's own external calendar app.

---

## Future Enhancements

Kept intentionally small — real, plausible, not required for release:

- Wire Booking Schedule into the wedding-day dashboard and Event Readiness card as a real navigation entry point (closes UX Improvement #6/#7 more completely than a single added link would).
- A true named/saved Calendar filter-preset system, if the product ever wants more than last-state memory (would need a small new backend table — out of scope for "operational, not architectural" work).
- Client-facing Calendar in the Wedding Workspace portal — already correctly named as unbuilt-and-deliberately-out-of-scope in `docs/calendar-platform-integration.md` §7, unchanged here.
- A genuine appointment-type catalog and travel/prep buffer split, if a venue's real-world need for more than "tour" ever materializes.
- Staff-conflict detection, once staff scheduling itself becomes a first-class concept beyond `assigned_to_staff_id`'s current filter-only role.

---

## Phase 1 — Release Blockers (implemented, verified)

### 1. Calendar navigation date-loss bug — fixed

`lib/calendar/view-data.ts`'s `resolveCalendarView()` now threads the currently-viewed date through Week/Day navigation into `year`/`month` correctly, and `week-view.tsx`/`day-view.tsx`/`calendar-view.tsx`'s keyboard handler all pass the date they're actually viewing rather than omitting it. Switching from Week or Day to Month or Agenda now lands on the month/date actually being viewed, not the real current month.

### 2. Tour scheduling now enforces the same hard-block rule as event creation — fixed

`components/leads/relationship-card.tsx`'s `ConflictWarning` now wires `onStatusChange` to a `tourDateBlocked` state, and the tour-scheduling save action is disabled exactly the same way `event-form.tsx` already disables event creation on a hard conflict — matching, not inventing, the existing pattern.

---

## Phase 2 — UX Improvements (implemented, verified)

Selected for implementation: the items directly serving the audit's own named operational questions and highest real-world friction, kept within "operational, not architectural" scope.

1. **Agenda view gained on-screen prev/next/today controls** — matching Month/Day's existing pattern, closing the mobile-usability gap named above.
2. **Week view gained an on-screen "Today" button** — matching Month/Day.
3. **Room and staff now render as visible text on calendar items** where the data exists (`spaceName` on the wedding-day event item, `assignedToName` on Planning items) — a small subtitle addition, not a redesign, directly closing the "What room? What staff member?" gap without leaving Calendar.
4. **Booking Schedule gained a real entry point**: a link from the Event Detail page (and the wedding-day dashboard) directly into `/calendar/booking/{eventId}` — closing the discoverability gap without building any new page.

**Not implemented in this pass, named honestly:** Calendar text search (a genuinely new, non-trivial capability, not a small UX fix) and true named/saved filter presets (needs new backend storage) are both listed under Platform Gaps/Future Enhancements rather than attempted here, consistent with "operational, not architectural."

---

## Phase 3 — Full Verification

- **Full-repo `tsc --noEmit`**: clean, zero errors, before and after every change in this pass.
- **Full-repo `eslint`**: identical pre-existing baseline, zero new issues introduced.
- **Navigation bug**: re-traced the exact failure path (Week view several months forward → switch to Month) against the fixed code; `year`/`month` now correctly reflect the viewed period at every navigation call site.
- **Tour conflict block**: re-traced `relationship-card.tsx`'s save path against the fixed wiring; a `calendar_blocked` date now disables the tour-scheduling save button exactly as it already does for event creation, with the identical advisory-vs-error visual treatment already established by `ConflictWarning`.
- **Ownership boundary**: re-confirmed `lib/calendar/service.ts`, `lib/calendar/booking-schedule.ts`, and `lib/calendar/view-data.ts` contain zero write operations against any table other than what `lib/availability/`'s own dedicated action layer already owns — Calendar's changes in this pass are additive display/navigation fixes, not new business logic, and Calendar still owns nothing but time.
- **Room/staff display**: confirmed the added subtitle text reads directly from the same `spaceName`/`assignedToName` fields Phase 4 already populated — no new query, no new computation.

---

## Release Recommendation

# Ready

**Justification.** The Scheduling domain, audited end to end from first inquiry through wedding day, is substantially more complete and more carefully built than its own task brief's example gap list implied — real business hours, real holiday/blackout handling via a deliberately reused mechanism, a genuine self-service tour-booking workflow, and real, tiered (hard-block vs. advisory) conflict detection all already exist and were verified working, not assumed. The two genuine Release Blockers found — a silent, wrong-month navigation bug and an inconsistently-unwired conflict block on tour scheduling — were both narrow, well-diagnosed, and fixed without touching architecture, ownership, or any other feature's data. Calendar's ownership boundary (time only, `calendar_blocks` only) held throughout this entire audit and this entire fix pass, confirmed directly against the code rather than assumed from the architecture docs.

What remains open — a distinct consultation appointment type, a full appointment-type catalog, travel/prep buffer separation, staff-conflict detection, template-level meeting scheduling, Calendar search, true saved filter presets, and iCal export — is real, honestly named, and is net-new platform capability rather than a defect in what already ships. A venue can genuinely run its scheduling operation end to end today: define availability, take tour requests, book and conflict-check events, schedule every kind of booking-phase meeting (manually, without a workaround), see its month/week/day/agenda/booking-level views, print and export them, and operate a real wedding day with Calendar, Timeline, and the wedding-day dashboard all pointing at the same underlying facts, never a second copy of them.
