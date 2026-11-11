# HTC Reporting Experience Pass — Audit, Visualizations, Willow Grove Demo Data

**Sandbox only. Production untouched.**

## A. Current reporting audit and findings

| Tab | Useful today | Weak / misleading | Gap |
|---|---|---|---|
| Overview | KPI grid, Business Funnel, period vs cohort orientation | Bookings-by-Source alone (no leads composition); no volume trend | Leads by Source + lead trend |
| Sales | Cohort conversion table, funnel progression, coverage | Source table dense; monthly-only lead trend → one bar on This Month | Leads doughnut; Conversion by Source labeling; adaptive trend |
| Bookings | Lifecycle booking KPIs; Bookings by Source | Monthly-only trend; empty when `lifecycle_booking_events` missing | Adaptive trend; demo lifecycle backfill |
| Revenue | Contracted / collected / outstanding definitions clear | Single contracted trend; monthly-only; contracted empty without signed contracts | Dual contracted vs collected trends; unlock contracts in demo |
| Events | Event list + type counts | Type list only; monthly trend | Type doughnut; adaptive trend |
| Saved | CSV of overview metrics | Unchanged | Compatible |

**Root causes of “one enormous green bar”:** all trends used calendar-month buckets (`monthBuckets` / bookings page month loop), so This Month → 1 bar.

**Willow Grove (pre-seed audit):** 54 leads, 0 `lifecycle_booking_events`, 0 `canonical_bookings` (unsigned contracts despite paid deposits), sources heavily `other`/`website`, Ellie preserved.

## B. Chart / layout changes (implemented)

1. **Adaptive trend granularity** (`lib/reporting/trend-buckets.ts`): ≤45d daily, ≤120d weekly, else monthly; zero-activity buckets included.
2. **Leads by Source** doughnut (Overview + Sales) alongside preserved Bookings by Source.
3. **Conversion by Source** table retained (renamed for clarity).
4. **Revenue:** side-by-side Contracted vs Collected trends (different date bases labeled).
5. **Events:** type doughnut + adaptive volume trend in two columns.
6. **ComparisonCard `tone`** restored on main (unblocks venue-app build after Bookings-by-Source merge).
7. Generic `SourceCompositionChart` reused by Bookings-by-Source wrapper.

## C. Demo-data inventory and additions

Script: `scripts/sandbox/willow-grove-reporting-demo-data.mts`  
Tag: `reporting-12mo-v1` · emails `*@rpt.willowgrove.demo` · venue `31f38b79-…` only · Sandbox URL guard.

| Action | Intent |
|---|---|
| Backfill lifecycle first_booked for existing booked leads/clients | Populate Bookings reports without deleting polished couples |
| Remap unprotected `other` → real sources | Meaningful source charts |
| ~108 planned seasonal seed leads | 12-month volume, mix of sources/outcomes |
| Lifecycle + first_booked_at (not direct sales_stage=booked) | Respect book_relationship trigger |
| Clients/events with space + assignments | Satisfy multi-space booking guard |
| Signed contracts + paid deposits (no Stripe) | Unlock canonical contracted revenue |
| Spread clustered paid_at | Collected trend readability |
| Rebooked + cancelled + missing attribution examples | Edge cases |

**Preserved:** Ellie St. James, Avery Blake demo leads, existing portals/contracts content.

## D. Implementation and tests

- Unit: `lib/reporting/trend-buckets.test.ts` + existing bookings-by-source tests (pass).
- App wiring: Overview, Sales, Bookings, Revenue, Events.
- Demo script applied to Sandbox (see section F for live counts).

## E. Screenshots

Captured after Sandbox deploy of this branch (paths under `docs/design/reporting-experience-pass/screenshots/`).

## F. Sandbox deployment / remaining issues

- Deploy this branch via Deploy Sandbox GHA (includes ComparisonCard tone fix).
- Demo data already written to Sandbox DB (independent of image deploy).
- Remaining: confirm Saved Reports UI still loads; mobile screenshots after deploy; any seed rows that failed schema guards are retried by re-running `--apply` (idempotent).
