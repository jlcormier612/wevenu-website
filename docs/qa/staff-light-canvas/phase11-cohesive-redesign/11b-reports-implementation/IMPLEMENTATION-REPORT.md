# Phase 11B — Reports visual implementation

**Date:** 2026-11-03  
**Mode:** Local implementation + visual acceptance only — **no commit / push / deploy**  
**Branch:** dirty `feat/spaces-booking-e1-smart-fields` (Phases 10 + 11A preserved)

## Refinements vs original mockups

| Refinement | Implementation |
|---|---|
| Outstanding not blush | `tone="outstanding"` → `--htc-linen` (`#F3F0E9`) always — independent of balance |
| Collected stronger than Contracted | Contracted → `--htc-botanical-pale`; Collected → `--htc-eucalyptus-surface` |
| Preserve Phase 10 controls | No changes to `reports-layout-shell`, `report-tabs`, `date-range-control` |

## Files changed

| File | Change |
|---|---|
| `app/globals.css` | `.htc-report-kpi`, `.htc-report-metric-tile`, `.htc-report-saved-shell` tone rules |
| `components/dashboard-system/comparison-card.tsx` | `ComparisonTone` + `tone` prop → `data-tone` |
| `components/reporting/business-funnel.tsx` | Period + cohort metric tiles with family tones |
| `app/(app)/reporting/page.tsx` | Overview ComparisonCard tones |
| `app/(app)/reporting/sales/page.tsx` | Mini-tile tones |
| `app/(app)/reporting/bookings/page.tsx` | ComparisonCard tones |
| `app/(app)/reporting/revenue/page.tsx` | ComparisonCard tones |
| `app/(app)/reporting/events/page.tsx` | `tone="ops"` |
| `components/reporting/saved-report-list.tsx` | Linen shell wrapper |
| `lib/theme/phase11b-reports-tones.test.ts` | New regression suite |

## Reusable API

```ts
tone?: "sales" | "bookings" | "contracted" | "collected" | "outstanding" | "ops" | "neutral"
```

Tone = metric **family**. Polarity remains separate (`up-good` / `up-bad` / `neutral`) for comparison text only.
