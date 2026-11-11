# Multi-day booked event vs public calendar — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** GREEN

| Field | Value |
|---|---|
| Commit | `a5d36b9291285ec6bedaf18383635e2dba11d0cd` |
| Migration | `20261418300000_schedule_overlap_same_calendar_day.sql` |
| Migration run | https://github.com/jlcormier612/wevenu-website/actions/runs/38324248031 |
| App deploy | Not required (SQL-only; public calendar uses DB RPCs) |
| Serving tip (unchanged app) | `dpl=4765f568…` |

## Verdict

1. **Public calendar Available on Sept 3–4 is correct** under established choose_available + simultaneous-venue rules. Ellie’s booking is in occupancy; Meadow Lawn remains free for a full-day Event, so `_is_event_date_available` returns true. Legend: *“Available dates can still be requested. Not available means this venue cannot take an event that day.”*

2. **Secondary fix:** undated candidate windows no longer collide with other days’ component spaces. Bridge Friday evening is allowed; Barn Friday evening still blocked.

## Evidence

- `FORENSIC.md` — persisted ESA + pre-fix RPC matrix  
- `browser-results.json` — DB + public calendar GREEN  
- Screenshots — `public-calendar-sept-2027.png`, reload  

## Tests

`lib/availability/multi-day-public-calendar-occupancy.test.ts` + existing event-occupancy suite — pass
