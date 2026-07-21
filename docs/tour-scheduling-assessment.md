# Tour Scheduling Completion — Assessment

**Sprint 3, Item 1. Launch-blocking completion, not a redesign.**
**Status: Research only. No code has been written. Waiting for approval before implementation.**

**Date:** 2026-07-21

---

## 1. Architecture — how this works today

### 1.1 Where tour settings live

Tour scheduling has no dedicated settings table — it's seven columns bolted directly onto `venues` (`supabase/migrations/20260628160000_tour_scheduling.sql:20-33`):

```
tour_scheduling_enabled  boolean
tour_embed_key           text (unique, public booking-page identifier)
tour_duration_minutes    integer  default 60
tour_min_notice_hours    integer  default 24
tour_max_advance_days    integer  default 90
tour_buffer_minutes      integer  default 30
tour_page_headline       text
tour_page_description    text
```

Read/written directly by `lib/tours/service.ts:244-270` (`getTourSettings`/`updateTourSettings`) — no repository indirection layer, unlike most other domains in this codebase.

**Answering the core question directly: tour hours are neither hardcoded nor independently configurable — they are 100% inferred from the venue's single, general set of business hours.**

There is no day-of-week or time-window concept anywhere inside Tour Scheduling itself. Instead, the slot generator reads `venue_business_hours` (`day_of_week`, `is_open`, `open_time`, `close_time` — one row per day, `supabase/migrations/20260626090000_venue_foundation.sql:76-84`), the same table that powers Settings → Hours for the whole venue. The Tour Settings UI is explicit about this dependency — its own empty-state copy reads *"No slots available… Check your business hours in Settings → Hours"* (`components/settings/tour-settings-section.tsx:32`).

This is the central problem this sprint needs to solve: **a venue cannot today configure "Tuesday 10–1, 2–6" for tours specifically** — they can only set one open/close window per day for the entire venue, and tours inherit it verbatim.

### 1.2 Slot generation pipeline

One shared Postgres function does all the work, and — this is worth stating clearly, because it easily could have drifted — **both the public booking page and the coordinator-facing scheduler call the identical function**, confirmed by direct trace:

```
public._generate_tour_slots(venue_id, start_date, end_date, exclude_appointment_id)
  supabase/migrations/20260922000000_coordinator_tour_scheduling.sql:45-164
```

Per calendar day in the requested range, it:
1. Skips the day entirely if a `calendar_blocks` row of `type = 'blocked_time'` covers it.
2. Looks up `venue_business_hours` for that day-of-week; skips the day if `is_open = false` or no row exists.
3. Steps from `open_time` to `close_time` in increments of `tour_duration_minutes + tour_buffer_minutes`, emitting one candidate slot per step.
4. Drops any candidate slot that overlaps a non-cancelled `tour_appointments` row, or any candidate on a day with a non-cancelled `events` row (an event booked that day blocks the *entire day*, not just its hours).

Two callers wrap it:
- `get_tour_slots(embed_key, start, end)` — public path, resolves the venue from the embed key, requires `tour_scheduling_enabled = true`. Called by `app/api/tours/slots/route.ts` → `lib/tours/service.ts:89-95`.
- `get_coordinator_tour_slots(start, end)` — coordinator path, resolves the venue from the authenticated session, deliberately **not** gated on `tour_scheduling_enabled` (a coordinator can still hand-schedule a tour for a Lead even with the public widget switched off — confirmed intentional by comment at `20260922000000...sql:192-198`).

**Public booking page**: `app/book/[key]/page.tsx` → `TourScheduler` component → `GET /api/tours/slots` on every month change → `get_tour_slots` → `_generate_tour_slots`. **The "Available Slot Preview" inside Settings hits the exact same `/api/tours/slots` endpoint** (`components/settings/tour-settings-section.tsx:157-161`, `SlotPreview` at lines 16-56). This means the requirement *"Slot Preview must become the output of the configured availability, never the source"* is **already true today, architecturally** — the preview has no independent slot logic of its own to remove. It will continue to be true automatically once `_generate_tour_slots` is rewritten to read the new weekly-schedule tables instead of `venue_business_hours` — no separate preview fix is needed, only verification that it still points at the same rewritten function.

### 1.3 Existing settings that must keep working unchanged

`tour_duration_minutes`, `tour_buffer_minutes`, `tour_min_notice_hours`, `tour_max_advance_days` are read as plain venue-row values inside `_generate_tour_slots` and are **completely orthogonal to where the day/time windows come from**. Nothing about this plan touches these four columns, their UI fields, or their role in the slot-stepping algorithm — they compose cleanly with the new weekly-availability model without modification.

### 1.4 Existing exception/closure support

There is no tour-specific exception concept. The only thing tour slots currently respect is the *general* Calendar feature's `calendar_blocks` table (`type = 'blocked_time'` rows only — other types like `holiday`-labeled `reason` values or `wedding_event_booking`/`private_event` placeholder types are calendar-visible but **not** currently treated as tour closures; see Bug #3 below). This is a shared-with-Calendar mechanism, not something Tour Scheduling owns — a real gap against this sprint's requirement for dedicated blocked-dates/holidays/closures support with room to grow into seasonal schedules.

### 1.5 Existing tour bookings & double-booking protection

`tour_appointments` (venue_id, lead_id, `scheduled_at`, `duration_minutes`, `status`) is the booking record. Double-booking protection is layered, not a single constraint:
1. Display-time: `_generate_tour_slots` excludes any slot overlapping a non-cancelled appointment.
2. Write-time: `book_tour`, `book_tour_for_lead`, and `reschedule_tour` each independently re-check the same overlap condition immediately before insert/update — a race-condition guard for the gap between "shown as available" and "actually booked."

This is application-level (check-then-insert inside `SECURITY DEFINER` functions), not a database exclusion constraint. It has worked correctly to date and this plan does not change that mechanism — it only changes *what counts as available in the first place* (the weekly-schedule + exceptions rewrite). Every existing booked `tour_appointments` row is keyed by `scheduled_at`/`duration_minutes` independent of how availability windows are configured, so **rewriting the availability source cannot orphan or corrupt existing bookings** — it can only change what future slots get offered.

---

## 2. Discovered bugs

### Bug #1 — Settings Save navigates away from the whole Settings page (confirmed, must-fix, explicitly named in the launch requirement)

`components/settings/tour-settings-section.tsx:73-88`:

```tsx
function handleSave() {
  startSave(async () => {
    const { updateTourSettingsAction } = await import("@/app/(app)/settings/tour-actions");
    const result = await updateTourSettingsAction(s);
    if (result.ok) {
      toast.success("Tour settings saved.");
      if (s.tourSchedulingEnabled) {
        router.push("/dashboard?milestone=tour_scheduling");   // ← the bug
      } else {
        router.refresh();
      }
    } else {
      toast.error("Could not save settings.");
    }
  });
}
```

Whenever `tourSchedulingEnabled` is `true` at save time — the normal state for any venue actively using this feature — Save fires the success toast and then **immediately navigates the whole browser away to `/dashboard`**. This isn't a one-time "you just turned this on" congratulation gated on an off→on transition; it fires on *every* save while the toggle is on, including saves that only touch duration/buffer/notice/copy fields. The `router.refresh()` branch (the toggle-off case) is the behavior that should apply unconditionally.

**Recommendation:** remove the `router.push` entirely. Save always does: persist → toast → `router.refresh()` (or nothing at all, since the section already holds local state and doesn't strictly need a full refresh) → remain on `/settings`. This drops the "congratulate on first enable" redirect behavior. If that congratulation is still wanted, it should be an inline banner state keyed off a real off→on transition, not a navigation — flagging this as a design choice to confirm at approval, not assuming it back in silently.

### Bug #2 — Manual "booking placeholder" calendar entries don't block tour availability (real gap, not just a missing feature)

`calendar_blocks` rows of `type IN ('wedding_event_booking', 'private_event')` — added specifically so a coordinator can mark a date as booked before a full Lead/Event record exists (`20260914000000_calendar_booking_placeholder.sql`) — are invisible to `_generate_tour_slots`, which only treats `type = 'blocked_time'` as a closure. The double-booking-protection migration's own stated principle is that a venue's administrative block on a date should mean **zero public availability** — this placeholder type violates that principle today. A coordinator who manually marks a date as booked via this placeholder will still see the public tour widget offer that date to a stranger.

**Recommendation:** fix this as part of the `_generate_tour_slots` rewrite this sprint is already doing — it's the same function, and this directly bears on this sprint's own verification requirement that "existing booked tours remain respected." Flagging for approval rather than assuming it's in scope, since it's a bug found during assessment, not something explicitly named in the sprint prompt.

### Bug #3 — Plausible timezone mismatch between slot generation and confirmation display (unverified, flagging for a decision, not assuming it's real)

`venue_business_hours.open_time`/`close_time` are stored as venue-local wall-clock strings (venue default timezone `America/New_York`, not UTC). But `_generate_tour_slots` builds slot timestamps as `(date || ' ' || open_time || ' UTC')::timestamptz` — treating the stored local wall-clock time as if it were literally UTC, rather than converting via the venue's real `timezone` column the way `lib/venue/timezone.ts`'s `venueLocalToUtcIso`/`utcToVenueLocalParts` helpers were built to do for exactly this class of bug elsewhere in the codebase. The slot label shown on the public picker is computed the same (incorrect) way, so the picker is internally consistent — but the post-booking confirmation screen formats the same `scheduled_at` value using the *browser's real local timezone* (`components/tours/tour-scheduler.tsx:51-53`), which could disagree with what the picker showed for any venue not physically in UTC (i.e., nearly every venue on the platform, given the default).

**This is genuinely unverified** — I have not clicked through a live booking to observe the actual displayed times differ; I'm flagging it as a real code-level risk found by inspection, not a confirmed customer-visible bug.

**Recommendation:** since this sprint is already rewriting `_generate_tour_slots`, it's low-marginal-cost to fix the timezone handling in the same pass using the existing `lib/venue/timezone.ts` helpers (ported into the new PL/pgSQL function, or by moving slot-time construction into application code — worth a design decision at approval time). Would like a decision on whether to (a) fix in this sprint since we're touching the function anyway, or (b) verify first with a quick manual test, or (c) explicitly defer as a separate ticket. Recommend (a) if the fix is as contained as it looks, given "verify, fix, re-verify" is this engagement's standing discipline.

---

## 3. Implementation plan

### 3.1 New schema

**`tour_availability_windows`** — the weekly recurring schedule. Multiple rows per day are the mechanism for multiple windows per day (e.g. Tuesday 10:00–13:00 *and* 14:00–18:00 are two separate rows); a day with zero rows is closed for tours.

```
id            uuid pk
venue_id      uuid fk venues, cascade
day_of_week   smallint  check (0-6)
start_time    time
end_time      time  check (end_time > start_time)
sort_order    smallint default 0
created_at / updated_at
```
RLS: `venue_id = current_user_venue_id()`. Grants: `select, insert, update, delete` to `authenticated` (coordinator Settings UI reads/writes directly); no `anon`/`service_role` grant needed — the public path only ever reaches this table indirectly through the `SECURITY DEFINER` slot-generation function, same pattern as `venue_business_hours` today.

**`tour_availability_exceptions`** — blocked dates, holidays, venue closures, tour-specific (decoupled from the general Calendar's `calendar_blocks`, which serves a different concern — a coordinator's personal calendar entry isn't necessarily "tours are closed that day"). Modeled as a date **range** rather than a single date so a multi-day venue closure is one row, not N rows, and so the shape can grow into seasonal schedules later without a new table:

```
id            uuid pk
venue_id      uuid fk venues, cascade
start_date    date
end_date      date  check (end_date >= start_date)
label         text  (e.g. "Christmas," "Staff retreat," "Winter closure")
created_at / updated_at
```
Any date falling inside `[start_date, end_date]` for the venue is fully closed for tours — no partial-day exceptions in this pass (matches the sprint's stated scope: "Blocked dates, Holidays, Venue closures," not "custom hours for a specific date," which is exactly the kind of thing this shape can add later — a nullable `custom_windows` column or a linked override table — without redesigning the table itself). RLS/grants identical pattern to the table above.

**Backward-compatible data migration (critical — without this, every existing venue goes from "tours bookable" to "tours show zero availability" the instant this ships):** the same migration that creates `tour_availability_windows` seeds one row per currently-open day, per existing venue, copied straight from that venue's current `venue_business_hours` (`is_open = true` → one window, `open_time`→`close_time`). This is a one-time backfill at migration time, not an ongoing sync — after this ships, `venue_business_hours` and `tour_availability_windows` are independent, and a venue editing one does not affect the other. `venue_business_hours` keeps its existing role for everything else it's used for (Setup defaults, other venue-hours display) — this plan does not touch or deprecate it.

### 3.2 Rewrite `_generate_tour_slots`

Same function name and signature (no caller changes needed in `get_tour_slots`/`get_coordinator_tour_slots`/`book_tour`/`reschedule_tour` — they all just call it). Internals change from "read `venue_business_hours` for is_open/open/close" to:

1. Skip the date if it falls inside any `tour_availability_exceptions` range for the venue.
2. Skip the date if a `calendar_blocks` row of `type = 'blocked_time'` **or** `type IN ('wedding_event_booking', 'private_event')` covers it — this is Bug #2's fix, folded in here since it's the same code path.
3. Fetch all `tour_availability_windows` rows for that day-of-week (0 or more).
4. For **each** window independently, step from that window's `start_time` to `end_time` in `duration_minutes + buffer_minutes` increments, same stepping algorithm as today — just run once per window instead of once per day.
5. Everything downstream (overlap check against `tour_appointments`, same-day `events` check, `min_notice_hours`/`max_advance_days` bounds) is unchanged.

If Bug #3 (timezone) is approved for this sprint, the wall-clock→UTC conversion inside this rewrite uses the venue's real `timezone` column instead of assuming UTC.

### 3.3 Settings UI — `components/settings/tour-settings-section.tsx`

- **New: Weekly Availability editor.** Monday–Sunday (in that order — confirmed via `venue/types.ts` that `day_of_week` follows Postgres/ISO convention where the app's `week_starts_on` setting governs *display* order elsewhere, but I'd default this editor to Mon–Sun regardless of that setting since tour hours are a distinct concept from calendar display, unless told otherwise). Each day: an enable toggle and, when enabled, a list of window rows (start time / end time / remove button) plus "+ Add another window." Disabling a day clears its windows on Save (component-local state only preserves them for the current editing session — toggling off and back on before saving keeps unsaved edits; toggling off, saving, then back on starts empty). This trade-off is called out explicitly for approval — the alternative (a separate `is_enabled` flag per day, decoupled from windows, so previously-entered hours survive a save with the day off) is slightly more schema complexity for a UX nicety; recommend the simpler version unless you want the persistence-across-saves behavior.
- **New: Exceptions manager.** A simple add/list/remove UI: pick a start date (and optionally an end date for a range), an optional label, add to the list. Existing exceptions listed with a remove action.
- **Unchanged:** duration/buffer/min-notice/max-advance fields, page headline/description, the enable toggle, the Slot Preview (verified in §1.2 to need no code change, only re-verification post-rewrite).
- **Bug #1 fix:** `handleSave` drops the `router.push`, always does persist → toast → stay put (matching the existing toggle-off branch's behavior for both cases).

### 3.4 Sequencing

1. Migration: new tables + RLS/grants + backfill from `venue_business_hours`.
2. Rewrite `_generate_tour_slots` (+ Bug #2, and Bug #3 if approved) — verify via direct SQL calls against real fixtures before touching any UI, same discipline used throughout this engagement.
3. Settings UI: weekly editor + exceptions manager + Bug #1 fix.
4. Live verification (§4).
5. Documentation update.

---

## 4. Verification plan

Following this engagement's standing discipline: real fixtures, real authenticated sessions (never the superuser CLI session, which bypasses RLS), cleanup to zero residue after each test.

1. **Availability generates correctly.** Configure a venue with an irregular weekly schedule (e.g. Tuesday two windows, Wednesday closed, Saturday one long window) via direct SQL fixture, call `_generate_tour_slots` directly, confirm the exact expected slot times come back — including that a closed day produces zero slots and a two-window day produces two separate contiguous runs of slots with a gap between them.
2. **Preview updates correctly.** Confirm `/api/tours/slots` (the same endpoint the Settings Slot Preview calls) reflects a change to the weekly schedule or a new exception immediately after saving — no caching layer to worry about, since this is a live RPC call each time.
3. **Public booking page respects availability.** `curl` `/api/tours/slots?key=...` for a real venue's embed key across a date range spanning a configured exception; confirm the excepted dates return no slots and every other date matches the configured windows.
4. **Existing booked tours remain respected.** Insert a real `tour_appointments` fixture inside a newly-configured window; confirm it's excluded from the slot list and that `book_tour`'s write-time overlap re-check still rejects a conflicting booking attempt. Also verify Bug #2's fix: a `wedding_event_booking`-type `calendar_blocks` fixture now correctly zeroes out that day's slots.
5. **Settings save correctly without leaving the page.** Exercise the save handler with `tourSchedulingEnabled: true` and confirm no navigation occurs — the toast fires and the coordinator remains on `/settings` with the Tour Scheduling section still rendered and reflecting the just-saved values.
6. **Migration backfill.** Confirm, on a copy of representative existing venue data, that the backfill produces `tour_availability_windows` rows matching each venue's current `venue_business_hours` exactly — no venue silently loses availability on deploy.
7. **`tsc --noEmit` and `next build` clean**, filtering the pre-existing untracked `shared/relationships/` noise as established elsewhere in this engagement.

---

## 5. Open decisions needing approval before coding starts

1. **Bug #1 fix (Save navigation)** — approved implicitly by the sprint prompt itself; proceeding as described unless told otherwise.
2. **Bug #2 fix (booking-placeholder closures)** — recommend fixing in this sprint since it's the same function being rewritten; please confirm.
3. **Bug #3 (timezone mismatch)** — recommend fixing in this sprint since the function is already being touched; please confirm, or tell me to verify-first / defer.
4. **Day-disabled persistence** (§3.3) — recommend the simpler "zero windows = closed" model without a separate per-day enabled flag; please confirm, or ask for the flag-based version if you want previously-entered hours to survive a save while a day is toggled off.
5. **Exception granularity** — this plan implements whole-day-range closures only (no partial-day exceptions, no recurring-annually holidays yet). Confirm this matches "Blocked dates, Holidays, Venue closures" as intended, or flag if partial-day/recurring-annual exceptions are actually wanted now rather than later.
