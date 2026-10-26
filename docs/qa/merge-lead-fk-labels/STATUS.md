# STATUS — Merge Lead FK preview labels

**Verdict: IN PROGRESS** (awaiting Sandbox serve + browser)

## Root cause

Merge preview `FieldDiff` stored and rendered `planned_event_space_id` / `assigned_staff_id` as raw UUID strings. Underlying IDs were correct for merge execution; presentation lacked authoritative name resolution.

## Fix

- Preview loads `venue_spaces.name` and `venue_staff.full_name` for FK ids in diffs
- `FieldDiff` keeps `*Value` as IDs and adds `*Display` for venue-facing labels
- Dialog renders via `fieldDiffShown` only
- Missing related rows → `Unnamed event space` / `Unknown staff member` (never UUID)

## Tests / build

| Check | Result |
|-------|--------|
| `merge.test.ts` + `merge-client-boundary.test.ts` | **39 pass** (`unit-test.log`) |
| `npm run build` | **EXIT 0** (`production-build.log`) |

## Production

**Untouched.**
