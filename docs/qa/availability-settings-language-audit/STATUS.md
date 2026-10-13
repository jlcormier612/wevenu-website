# Availability settings language — copy corrections

**Status:** Implemented locally — awaiting Sandbox deploy + UI verify  
**Date:** 2026-10-13  
**Scope:** Copy/documentation only. No availability logic, defaults, DB, or layout redesign.

## Locked behavior preserved

- Default: confirmed event closes public availability venue-wide.
- Opt-in: `allow_simultaneous_public_availability` + max simultaneous events ≥ 2 + free Event Space.
- Capacity alone does not enable simultaneous public availability.
- Tours remain a separate setting.

## Exact changes

| Surface | Change |
|---------|--------|
| `components/availability/capacity-rules-section.tsx` | Max simultaneous events hint: neutral “hosts one event at a time”; states capacity ≠ public inquiries; points to Date holds → confirmed-event control; Event Spaces note for 2+. |
| Same | Turnaround hint: neutral wording; states turnaround does not change public Available for confirmed events. |
| `app/(app)/settings/availability/page.tsx` | Scheduling Capacity description: staff limits do not override public confirmed-event preference. |
| `lib/help-guides/final-articles.ts` (`how-does-date-availability-work`) | Default close + Settings opt-in path + max≥2/space requirement + capacity/tour separation. |
| `lib/help-guides/setup-guides.ts` (`setup-calendar-availability`) | Current section list; new step for confirmed-event public preference; capacity tip clarifies public opt-in is separate. |
| Same (`understanding-your-calendar`) | Hold troubleshooting + completion corrected to match Hold setting (default closes public; not “doesn't block by design”). |
| `components/settings/simultaneous-public-availability-control.tsx` | Removed duplicate “Recommended” footer (radio already says Recommended). |
| `lib/availability/venue-controlled-availability-copy.test.ts` | Locked expectations updated to shipped guidance; calendar path → `calendar-page-client.tsx`. |

## Tests

`npx tsx --test` on:

- `lib/availability/venue-controlled-availability-copy.test.ts`
- `lib/availability/simultaneous-public-availability.test.ts`
- `lib/leads/lead-date-availability.test.ts`
- `lib/help-guides/setup-guides.test.ts`
- `lib/help-guides/final-articles.test.ts`

**Result: 60/60 pass.** Behavior suites (simultaneous public + lead date availability) unchanged green.

## Diff review

Six files only (copy/docs/tests). No occupancy/precheck/SQL/settings-action changes.

## Deploy / verification

- Prior unrelated Deploy Sandbox `38475580540` (`d5e36593` email language) **failed** — diagnose/retry separately before overlapping.
- This copy commit: _(fill on commit)_
- Production: untouched

## Final state

Copy implemented and tested. **NOT GREEN for Sandbox UI** until deploy succeeds and Settings/Help surfaces are confirmed on the serving tip.
