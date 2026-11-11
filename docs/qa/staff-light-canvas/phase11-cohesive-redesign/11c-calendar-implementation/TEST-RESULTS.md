# Phase 11C Calendar — Test Results

## Automated

```bash
NODE_ENV=test npx tsx --test \
  lib/theme/phase11c-calendar-hospitality.test.ts \
  lib/theme/calendar-month-refinement.test.ts \
  lib/theme/calendar-week-day-agenda-refinement.test.ts \
  lib/theme/calendar-availability-sharing.test.ts
```

**Result: 41/41 pass** (initial suite including availability sharing); focused re-run of Phase 11C + Month + Week/Day/Agenda: **34/34 pass**.

Coverage includes:

- Eucalyptus intro + botanical accent
- Linen toolbar / filters
- Calm-blue guidance
- Legend removed; FilterBar retained
- Locked `--cal-*` hex values
- Print route free of Phase 11C chrome classes

## Live browser probes (`browser-results.json`)

| Check | Result |
|---|---|
| HTTP 200 on Month/Week/Day/Agenda | Pass |
| Eucalyptus intro (`rgb(220, 232, 224)`) | Pass |
| Linen toolbar/filters (`rgb(243, 240, 233)`) | Pass |
| Legend absent | Pass |
| `--cal-*` tokens unchanged | Pass |
| Page overflowX | None (desktop / 390 / 375) |
| View switcher + prev/next / select day / open Add form (cancel) | Exercised on Month 390 |
| Taxonomy chips present | Tour + Appointment (items present in demo month) |

## Limitations

- Fancy Venue November 2026 filter chips reflect **present** taxonomy only (Tour, Appointment). Event / Hold / Blocked chips appear when those item types exist — existing FilterBar behavior, not hidden by design.
- Print / Export control verified visually in screenshots; Playwright role probe for href was inconclusive (button+Link composition).
- No persistent schedule-item mutations performed for styling demos.
