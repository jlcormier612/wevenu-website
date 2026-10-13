# Nicole Bethune — calendar vs booking assignments

**Environment:** Sandbox only  
**Verdict:** GREEN (evidence-gated — not deploy-alone)

## Root cause

`getCalendarData` loaded `event_space_assignments` without `scheduled_date` and painted every timed component onto every protected event day. Multi-day bookings (May 8–9) therefore showed Rehearsal Dinner on Sunday and Barn filter hid Villa/Bridge/Lawn Sunday components while leaving a false Barn Rehearsal on Sunday.

Persisted Rehearsal Dinner end time is **21:00** (not 22:00). Calendar 6:00–9:00 PM matched DB; it was not a display truncation of 10:00 PM.

## Fix

`lib/calendar/event-assignment-projection.ts` + `getCalendarData` select/use `scheduled_date`. Legacy rows without `scheduled_date` still expand across protected days.

## Proof on serving `d753eafb` — 42/42

| Layer | Result |
|---|---|
| DB assignments | 5 components; dates/times/spaces match SoR (Sat Barn 18:00–21:00; Sun Villa/Bridge/Lawn/Barn as expected) |
| Projection helper | Sat = Rehearsal only; Sun = GR/Ceremony/Cocktail/Reception; Barn filter → Sat Rehearsal + Sun Reception only |
| UI day May 8 (All spaces) | Rehearsal 18:00–21:00; no Sunday components |
| UI day May 9 (All spaces) | No Rehearsal; all four Sunday components with correct times |
| Barn filter | Hides Villa/Bridge/Lawn (does not misplace them); clear filter restores them |
| Reload | Sat + Sun displays remain correct |
| Runtime | stayed `d753eafb4c24b918a682736f119674ec4bd18585` |

Artifacts: `db-baseline.json`, `FORENSIC.md`, `browser-results.json`, `browser-run.log`  
Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/38329788408

Production untouched. Remaining calendar work (appointment time-loss / read-only details / public past dates) was queued until this proof passed.
