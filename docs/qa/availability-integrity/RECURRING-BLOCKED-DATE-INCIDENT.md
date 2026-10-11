# Recurring blocked date / public inquiry — availability integrity

## Verdict

**GREEN** on Sandbox tip `8e4f911e` (migration + deploy). Meadowbrook annual Christmas is no longer selectable or submittable on the public inquiry form. Production untouched.

## Reproduction (confirmed)

| Item | Value |
|---|---|
| Venue | Meadowbrook Valley Venue `05f16a15-1752-4855-8a3b-aad5c593d8d9` |
| Form | `https://app.sandbox.hellotocheers.com/form/cd9e89529e65480ba8cfc6e154193d5a` |
| Mode | `inquiry_event_date_mode = choose_available` |
| Rule | `tour_availability_exceptions` id `a32242fa-…` — Christmas — `2026-12-25` — `annual` |
| Calendar | Projected Blocked Time “Christmas” on Dec 25, 2026 |
| Pre-fix API | `get_available_event_dates` returned **2026-12-25** and **2027-12-25** |

## Root cause

| Layer | Finding |
|---|---|
| Settings “Blocked Dates” | Persist in **`tour_availability_exceptions`** (not `calendar_blocks`) |
| Venue calendar | Read-only projection via `projectTourAvailabilityExceptions` → appears as Blocked Time |
| Public inquiry | `get_available_event_dates` → `_is_event_date_available` → **`covering_calendar_block_title` only** (`calendar_blocks`) |
| Tours | Already checked tour exceptions in `_is_tour_slot_blocked` |

So the calendar told the truth for the settings surface; the inquiry availability path ignored that table. Annual recurrence in SQL already existed for tours; inquiry never called it.

Secondary hardening: `_is_event_date_available` could previously `return true` on multi-space hold/occupancy paths **before** re-checking covering calendar blocks. Closures (tour exceptions + calendar_blocks) are now evaluated first.

## Fix

| Change | Location |
|---|---|
| `tour_availability_exception_covers_date(venue, date)` | Migration `20261415000000_inquiry_honors_tour_blocked_dates.sql` |
| `_is_event_date_available` calls tour exceptions + calendar blocks first | Same migration |
| Calendar loads `recurrence_rule` and annual rows into the month | `lib/calendar/service.ts` |
| Annual expansion in projection | `lib/calendar/tour-exception-projection.ts` |
| Regression tests | `lib/availability/inquiry-tour-blocked-dates.test.ts`, projection tests |

`create_public_lead` already revalidates `choose_available` with `_is_event_date_available` → `date_unavailable` (server-side). Request-mode venues unchanged (no forced availability gate).

## Affected entry points

| Path | Status after fix |
|---|---|
| Public inquiry available-dates API | Honors tour Blocked Dates |
| `create_public_lead` (choose_available) | Rejects blocked preferred date |
| Venue calendar projection | Annual Christmas in future Decembers |
| Schedule Tour / `_is_tour_slot_blocked` | Already correct; shared annual math |
| Staff preferred-date precheck TS | Still primarily occupancy/holds/calendar_blocks; SQL authority covers public form |
| Concurrent exclusive booking | Existing `assert_event_availability` / advisory locks unchanged this pass |

## Deploy / evidence

| Item | Value |
|---|---|
| Commit | `8e4f911eb6925b97d4403259a06fbeff1b0f4fb8` |
| Migration | [38184410687](https://github.com/jlcormier612/wevenu-website/actions/runs/38184410687) success |
| Deploy | [38184526089](https://github.com/jlcormier612/wevenu-website/actions/runs/38184526089) tip `8e4f911e` |
| Runtime `dpl` | `8e4f911eb6925b97d4403259a06fbeff1b0f4fb8` |
| Health | ok / supabase ok |
| QA script | `scripts/qa/recurring-blocked-date-inquiry-browser.mts` → GREEN |

### Runtime results (Meadowbrook)

| Check | Result |
|---|---|
| Christmas rule intact (not deleted) | PASS |
| API Dec 2026 excludes 12-25 (30 days) | PASS |
| API Dec 2027 excludes 12-25 | PASS |
| Dec 24 still available | PASS |
| `create_public_lead` Dec 25 → `date_unavailable` | PASS |
| No lead created on reject | PASS |
| Legitimate Dec 24 inquiry accepted then cleaned up | PASS |
| `tour_availability_exception_covers_date` true for Christmas | PASS |
| After refresh still excluded | PASS |

## Remaining risks / limitations

1. **Staff UI preferred-date precheck** still loads tour exceptions only for `type === "tour"` snapshots; public inquiry is SQL-authoritative. A follow-up could mirror exceptions into preferred_date precheck for in-portal warnings.
2. **`create_public_form_lead`** (legacy public_forms) may not call `_is_event_date_available` — venue embed form path used here is `create_public_lead`. Documented as adjacent; not exercised on Meadowbrook embed.
3. Concurrent exclusive **booking** protections were inspected (existing assert/lock path) but not re-load-tested in this pass — out of preferred-date selection scope.

## Production

Untouched. Sandbox only.
