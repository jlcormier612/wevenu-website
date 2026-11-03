# Final polish — verification notes

Captured against live local app (`HTC_CAPTURE_BASE` default `http://127.0.0.1:3000`), Jen's Fancy Venue, light theme.

## Desktop (1440×900)

| View | Screenshot | Views+date one linen row | Filters separate |
| --- | --- | --- | --- |
| Month | `evidence/month-desktop.png` | Yes | Yes |
| Week | `evidence/week-desktop.png` | Yes | Yes |
| Day | `evidence/day-desktop.png` | Yes | Yes |
| Month List | `evidence/agenda-desktop.png` | Yes | Yes |

Probe: `toolbarCount: 1`, `desktopSingleRow: true` for all four.

## Mobile

| View | 390 | 375 | Actions same row @375 | Overflow |
| --- | --- | --- | --- | --- |
| Month | `month-mobile-390.png` | `month-mobile-375.png` | Yes | No |
| Week | `week-mobile-390.png` | `week-mobile-375.png` | Yes | No |
| Day | `day-mobile-390.png` | `day-mobile-375.png` | Yes | No |
| Month List | `agenda-mobile-390.png` | `agenda-mobile-375.png` | Yes | No |

At 375px, action rects share the same `top` (201). Print / Export right edge ≈319 within 375 viewport. Stacked view/date nav retained on mobile.

## Functional smoke (month @ 375)

`evidence/month-mobile-375-after-smoke.png`

- Month → Week → Day → Month List → Month
- Previous/next date navigation
- Add Schedule Item open → Cancel
- Print / Export control present (entry point; no print write)

## Capture script

`capture-final-polish.mts` → writes `evidence/*`, `browser-results.json`, and Desktop copies under `/Users/jensmac/Desktop/htc-phase11c-calendar-final-polish/`.
