# Day-of Schedule → Timeline — forensic + fix

## Status: IMPLEMENTING (local); Sandbox verify pending

**Branch tip at start:** `942540a733ab6f7940328ec33a8fb292b8808dca`  
**Serving Sandbox (pre-fix):** Deploy run [38806570246](https://github.com/jlcormier612/wevenu-website/actions/runs/38806570246) success — no overlapping deploy.  
**Production:** untouched.

## Forensic findings (read-only)

### Three sources of truth (intentional)

| Layer | Storage | Role |
|-------|---------|------|
| Day-of Schedule form | `events.start_time`, `end_time`, `setup_time`, `teardown_time`, `guest_count` | Overall booking window / occupancy metadata |
| Component schedule | `event_space_assignments` (+ `scheduled_date`, times, space) | Per-use space + optional day/time |
| Timeline activities | `timeline_entries` (`entry_time`, `day_offset`, optional `source_space_use_key`) | Run-of-show items; template rows stay untimed unless venue sets times or schedule-sync materializes a component |

### Persistence works

- Day-of fields save/reload via Event form → `events.*` (verified on Fancy + Meadowbrook rows with non-null `start_time`).
- Component times+dates sync to timeline via `lib/timeline/schedule-sync.ts` when both `scheduled_date` and `start_time` are present (4/5 timed-assignment events have `source_space_use_key` rows; multi-day `day_offset` correct).
- Starters use `minutes_offset: null` → apply leaves `entry_time` null (“No time set”) by design — never invents clocks from overall start.

### Root cause (UX integration)

When `event_space_assignments` exist, Overview booking summary set `useComponentSchedule` and **hid** Day-of start/end/setup/teardown (only Guests + components, often “Time not set”). Saved Day-of settings therefore looked like they never “flowed,” even though they persisted. Timeline tab also showed no Day-of boundary context.

Not a failed Day-of save. Not a reason to stamp overall start onto every timeline activity.

### Multi-day model (already canonical)

- Event span: `events.event_date` + `event_end_date`
- Component day: `event_space_assignments.scheduled_date`
- Timeline day: `timeline_entries.day_offset` (0-based from `event_date`); entry form Day picker when multi-day
- Sync: `dayOffsetForScheduledDate` — skips when date or time missing (no guessing)

### Semantics decision (locked for this fix)

- Day-of overall times = **metadata** shown in Overview + Timeline context strips.
- Do **not** fabricate timeline activities or overwrite item-specific times from overall bounds.
- Guest count remains metadata (already shown on Overview).
- Component → timeline sync remains the path for timed Ceremony/Reception/etc. rows.

## Minimal fix

1. `formatDayOfBookingWindow` in `lib/events/booking-summary.ts`
2. Overview: always show Day-of window when times exist, **alongside** component schedule
3. Timeline: optional Day-of bounds strip (metadata only)
4. Regression tests in `booking-summary.test.ts`

No schema migration. No Production. No destructive data rewrite.
