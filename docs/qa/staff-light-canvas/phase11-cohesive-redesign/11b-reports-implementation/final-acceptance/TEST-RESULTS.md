# Phase 11B Final Polish — Test Results

**Date:** 2026-11-02 (local)  
**Command:**

```bash
NODE_ENV=test npx tsx --test \
  lib/theme/color-distribution-phase10*.test.ts \
  lib/theme/phase11a*.test.ts \
  lib/theme/phase11b*.test.ts
```

## Suite totals

| Bundle | Pass | Fail |
|---|---:|---:|
| Phase 10 polish (Documents + Reporting tabs) | all | 0 |
| Phase 11A record-link wiring | all | 0 |
| Phase 11B tones / wiring / final polish tabs | all | 0 |
| Phase 11B polarity (`phase11b-reports-polarity.test.ts`) | 6 | 0 |
| **Combined focused run** | **44** | **0** |

Narrow re-run after fade strengthening (`phase11b-reports-tones` + polarity + phase10 polish): **26 / 26 pass**.

## Live browser probes (`browser-results.json`)

- All six routes × desktop / mobile-390 / mobile-375 → HTTP **200**
- `overflowX: false` on every capture
- `activeFullyVisible: true` on every route load (ends + middle)
- Middle tabs (Bookings/Revenue): both edge fades + both chevrons present
- End tabs (Overview / Events / Saved): single directional fade + matching chevron
- Arrow click probes on Sales/Revenue/Events: scrollLeft changes; overlays remain non-interactive
- Outstanding live color: `text-success` / `rgb(93, 111, 93)` when balance decreased to `$0`
- Contracted/Collected decreases: `text-destructive` / `rgb(217, 154, 158)`
- Outstanding surface: linen `rgb(243, 240, 233)` (`#F3F0E9`)

## Limitations

- Fancy Venue demo data for Nov 2026 shows many `$0` / `0` KPIs — empty/zero presentation verified honestly; populated long-currency scenarios were not manufactured.
- Sales view uses metric tiles (not `data-report-kpi` ComparisonCards) — expected.
- Manual arrow browsing can scroll the active tab partially off-screen (by design); route changes re-center it.
