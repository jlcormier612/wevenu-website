# Reporting final quality pass

**Branch:** `fix/reporting-final-quality`  
**Base:** `origin/main` @ `df1aa331`  
**Venue:** The Willow Grove  
**PR #30:** untouched (separate safeguards work)  
**Production / Stripe / deploy:** not changed  

**Overall reporting pass:** GREEN for scoped items below  
**Full-app hospitality restoration:** still **IN PROGRESS** (not declared GREEN)

## A. Slow Day / Week / Month — root cause + timings

**Cause:** `TrendGranularityControl` called `router.replace` inside `useTransition`, forcing a full RSC re-render and re-query for the same date range just to change bucket grain.

**Fix:** Load observations once; `ClientTrendPanel` / `ClientLinkedTrendCharts` rebucket locally and sync URL without blocking selection.

| Environment | Avg click → pressed | Notes |
| --- | ---: | --- |
| Before Sandbox | **1433 ms** desktop / **1046 ms** mobile | Full navigation |
| After local | **60 ms** desktop / **39 ms** mobile | Local rebucket |
| Rapid Week→Day→Month→Week | before ~2492 ms; after **148 ms** | Last selection wins |

Evidence: `before-sandbox-timing.json`, `after-local-timing.json`.

## B. Screenshots

Desktop + mobile captures under this folder for Overview, Sales, Bookings, Revenue, Events, Saved (`after-local-*-desktop/mobile.png`). Sandbox before Overview/grain/doughnuts also captured.

## C. Reconciliation (Willow Grove, This Month)

| Metric | Source of truth | Expected | Actual | Verdict |
| --- | --- | ---: | ---: | --- |
| Lead cohort created | `leads.created_at` | 58 | 58 | PASS |
| Cohort later booked | first_booked | 26 | 26 | PASS |
| Cohort booked → Not recorded | frozen `acquisition_source` other/null → display | 24 | 24 | PASS |
| Period first_booked (reporting-scoped) | lifecycle events − excluded clients | 8 | 8 | PASS |
| Period known sources | known vocab | 7 | 7 | PASS |
| Current pipeline booked | `leads.sales_stage=booked` | 23 | 23 | PASS |
| Contracted | `canonical_gross_booked_revenue` | $64,500 | $64,500 | PASS |
| Collected | `canonical_payments_collected` | $28,725 | $28,725 | PASS |
| Period net (was Outstanding) | GBR − Collected | $35,775 | $35,775 | PASS |

**Attribution:** 24 Not recorded = 23 frozen `other` + 1 null. Display maps `other`→Not recorded by design. Not a silent attribution bug; do not invent/backfill sources.

**Outstanding semantics:** RPC is period GBR − period collected (mixed clocks). UI renamed to **Period net**; copy states it is not current receivables. True AR not invented without a supported point-in-time query.

## D. Files changed

- `lib/reporting/aggregate-trend.ts` (+test)
- `components/reporting/client-trend-panel.tsx`
- `components/reporting/client-linked-trend-charts.tsx`
- `components/reporting/trend-granularity-control.tsx`
- `components/reporting/source-composition-chart.tsx` (+color test)
- `components/reporting/business-funnel.tsx`
- `components/dashboard-system/trend-chart.tsx`
- `lib/reporting/service.ts`
- `lib/metrics/business-funnel.ts` (+test updates)
- Reporting pages: Overview, Bookings, Events, Revenue, Sales (milestones copy)

## E. Functional acceptance (local)

- Grain Day/Week/Month immediate; rapid switching OK  
- Period net label on Overview + Revenue  
- Doughnut legend colors match arcs; adjacent dark greens separated  
- Sales milestones rename  
- Saved / Sales / Bookings / Revenue / Events pages load (screenshots)  

Saved Report open/manage drill-downs: exercised page load; deep filter persistence left YELLOW pending longer interactive pass on Sandbox after deploy.

## F. Remaining issues

| Item | Severity |
| --- | --- |
| Grain/doughnuts/Period net not on live Sandbox until merge+deploy | YELLOW |
| Saved Report full open/manage/new-tab interactive matrix | YELLOW |
| Full-app hospitality restoration inventory | RED / IN PROGRESS (separate) |
| Branch protection / required visual ruleset enforce | RED (PR #30) |

## G. Hospitality / other work

Colored KPI tiles preserved. No Stripe/subscription/email/Production changes. No PR #30 overwrite. Floor-plan PR #31 remains separate.
