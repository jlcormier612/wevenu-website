# Edit event must not wipe booked component schedules

## Status: GREEN (Sandbox verified)

**Root-cause tip:** `4c94913f`  
**Selector/proof polish tip:** `889e5494` (serving)  
**Deploy:** [38318005494](https://github.com/jlcormier612/wevenu-website/actions/runs/38318005494) — `dpl=889e5494c8b3a766df11753af4cbc629f13d8520`  
**Browser evidence:** `browser-results.json`, `after-edit-event.png`, `browser-run.log`

## Confirmed root cause

`app/(app)/events/[id]/edit/page.tsx` mapped `initialAssignments` to `{ useKey, useLabel, spaceId }` only — dropping `scheduledDate`, `startTime`, and `endTime`.

`EventEditForm` always includes those partial assignments when `spaceOperatingMode === "multi"`. On Save, `updateEvent_` called `replace_event_space_assignments`, which wrote `null` over every component date/time. The schedule card then showed “Time not set.”

## Fix

1. Edit page passes full schedule fields into `initialAssignments`.
2. `updateEvent_` runs `preserveOmittedComponentScheduleFields` before replace so omitted keys keep persisted values; explicit `null` still clears (Edit schedule).

## Verification (disposable Meadowbrook)

| Check | Result |
|-------|--------|
| Setup-time edit preserves all five component dates/times/spaces | PASS |
| Setup time saved (`13:30`) | PASS |
| Guest-count edit preserves schedule | PASS |
| Guest count saved (`142`) | PASS |
| Schedule card has no “Time not set” after reload | PASS |
| Explicit Edit schedule (cocktail end → 18:30) works; ceremony unchanged | PASS |
| Unit: `edit-event-preserves-schedule` + `preserveOmittedComponentScheduleFields` | PASS |

## Data integrity

No erased production-like customer schedules were backfilled. Disposable fixtures only.

## Production

Untouched. No production deploy or configuration changes.
