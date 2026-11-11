# Phase 11B — Component & file map

## Shared (preferred change surface)

| File | Role | Proposed change |
|---|---|---|
| `components/dashboard-system/comparison-card.tsx` | All report KPIs | Add optional `tone` prop + classNames mirroring Snapshot treatments; keep polarity text logic |
| `app/globals.css` | Tokens already exist | Optional thin helpers e.g. `.htc-report-kpi--sales` if classNames preferred over Tailwind arbitrary vars; **reuse** `--htc-eucalyptus-surface`, `--htc-green-mist`, `--htc-botanical-pale`, `--htc-ivory`, `--htc-soft-blush`, calm blue |
| `components/dashboard/business-snapshot.tsx` | Reference only | **Do not change** for 11B — Reports should align *to* it |

## Reporting-specific

| File | Role | Proposed change |
|---|---|---|
| `components/reporting/business-funnel.tsx` | Overview period + cohort tiles | Apply family classes per stage/cohort tile |
| `components/reporting/reports-layout-shell.tsx` | Phase 10 intro | **No change** |
| `components/reporting/report-tabs.tsx` | Nav + mobile fades | **No change** |
| `components/reporting/date-range-control.tsx` | Linen filter | **No change** |
| `components/reporting/report-header.tsx` | Page titles | **No change** (or minor spacing only if required) |
| `components/reporting/detail-panel.tsx` | Drill-ins | **No change** |
| `components/reporting/saved-report-list.tsx` | Saved rows | Optional linen wrapper; no KPI tones |
| `components/dashboard-system/trend-chart.tsx` | Charts | **No change** |

## Pages (pass tones / tile classes)

| File | Change |
|---|---|
| `app/(app)/reporting/page.tsx` | Pass `tone` into each ComparisonCard |
| `app/(app)/reporting/sales/page.tsx` | Class family on mini-tile Links/divs |
| `app/(app)/reporting/bookings/page.tsx` | ComparisonCard tones |
| `app/(app)/reporting/revenue/page.tsx` | ComparisonCard tones (`owed` conditional) |
| `app/(app)/reporting/events/page.tsx` | `tone="ops"` |
| `app/(app)/reporting/saved/page.tsx` | Wrapper only if linen nest approved |

## Out of scope / do not touch

- Metric services under `lib/metrics/**`, `lib/reporting/service.ts` calculations  
- Phase 11A `.htc-record-link`  
- Calendar taxonomy colors  
- Isolated P1–9 release worktree  

## Risks

| Risk | Mitigation |
|---|---|
| Misreading blush Outstanding as “bad KPI” | Header-only when >0; keep accessible delta sentence; white when 0 |
| Tone prop breaks equal card heights | Keep Snapshot-like reserved slots / existing mt-auto sub |
| Funnel tile color implies conversion path | Copy already forbids dividing tiles; keep clocks visible |
| Sales page mini-tiles not using ComparisonCard | Shared CSS utility classes so Sales matches Overview |
| Over-coloring Saved | Explicit exception — white rows only |
