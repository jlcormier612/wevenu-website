# Work Package R1 — Reporting Foundation, Navigation & Core Venue Reports

Status: **Shipped and validated against real dev data.** 22/22 real cross-checks against the canonical metric layer pass. Full-project typecheck clean. No new competing metric formulas introduced.

## 1. Reporting information architecture

New navigation item, "Reports" (`/reporting`), added to the top "Overview" nav group right under Dashboard — the brief's own "should be able to find it immediately" requirement, given the existing "Analytics" nav entry sits three groups down under "Operations." Five shallow tabs, no nested sub-navigation:

```
Reporting
├── Overview   /reporting          "How is the business doing?"
├── Sales      /reporting/sales    "Where are opportunities coming from, how are they converting?"
├── Bookings   /reporting/bookings "What have we booked?"
├── Revenue    /reporting/revenue  "What have we earned and collected?"
└── Events     /reporting/events   "What's happening with our events?"
```

No additional categories were added — the brief's own five map cleanly onto what the canonical Metric Registry actually supports today.

## 2. Reporting vs. Dashboard distinction

Not touched, not copied. The Dashboard (Morning Briefing / Today's Attention / Upcoming / Business Snapshot / Quick Actions / Luv entry point) is unchanged — verified by inspection, zero Dashboard files were edited this phase. Reporting has no "what needs my attention today" content anywhere; every report is a period-over-period business question, never a task list.

## 3. Metric Registry integration — the one rule that mattered most

Every reported number in Sales, Bookings, Revenue, and the Overview traces to `lib/metrics/*`:

| Report field | Canonical source |
|---|---|
| Bookings (count) | `lib/metrics/booking.ts:getCanonicalBookings()` |
| Gross Booked Revenue | `lib/metrics/revenue.ts:getGrossBookedRevenue()` → `canonical_gross_booked_revenue()` |
| Payments Collected | `lib/metrics/revenue.ts:getPaymentsCollected()` → `canonical_payments_collected()` |
| Outstanding Balance | `lib/metrics/revenue.ts:getOutstandingBalance()` → `canonical_outstanding_balance()` |
| Average Booking Value | `lib/metrics/revenue.ts:getAverageBookingValue()` → `canonical_average_booking_value()` |
| Revenue by Category | `lib/metrics/revenue.ts:getGrossBookedRevenueByCategory()` |
| Conversion Funnel (7 stages + Booking Conversion Rate) | `lib/metrics/conversion.ts:getConversionFunnel()` → `canonical_conversion_funnel()` |

Two real, in-scope extensions were made to the canonical layer itself — not new formulas, the *same* formulas made date-window-aware (§5 below). Everything else (Leads count, Lead Source breakdown, Events count/type) reads plain, unambiguous columns that were never part of the duplicate-metric problem the certification found — there was no competing formula to consolidate for "how many leads," only for Booking/Revenue/Conversion, and those three are 100% canonical-sourced.

`grep`-audited after implementation (brief §57): no new function anywhere in this phase's changes independently recalculates what a Booking, Revenue, or Conversion stage is. `lib/reporting/service.ts`'s trend/bucketing functions are documented inline as re-groupings of already-canonical rows, not new definitions — see that file's own header comment.

## 4. Reporting Overview

`app/(app)/reporting/page.tsx`. Six `ComparisonCard`s (Bookings, Gross Booked Revenue, Payments Collected, Outstanding Balance, Leads, Booking Conversion Rate), each showing the current period, the prior-period comparison, and a link into the relevant full report. Four "View X" buttons below. Nothing else — no widget sprawl (brief §62's own "do not add 20 additional widgets").

## 5. A real gap found and fixed: the funnel and category breakdown couldn't be date-filtered

Reading `canonical_conversion_funnel()` before writing any UI found it took **zero parameters** — all-time only, unlike every canonical revenue function, which already accepted an optional `p_from`/`p_to` window. Building a real Sales report with a working date-range control was not possible without either (a) silently reinterpreting an all-time number as if it were windowed — the brief's own explicit warning — or (b) leaving the one report un-filterable while every other report responded to the same control.

Fixed by parameterizing the *same* formula (migration `20261257000000_reporting_funnel_date_window.sql`): every one of the seven stages now optionally filters to leads whose `created_at` falls in the window — one consistent "entered the pipeline in this period" semantic across all seven stages, not a mix of dates. `p_from`/`p_to` both default to `null` (all-time), so this is additive — verified live (§10, test 4i) that a `null` window still returns the exact prior all-time behavior.

The same real lesson from Work Package D5E recurred and was pre-empted this time: `CREATE OR REPLACE FUNCTION` with a changed parameter list creates a second overloaded function instead of replacing it, breaking PostgREST resolution (`PGRST203`). The migration explicitly `DROP FUNCTION`s the old 0-arg signature first — caught in review this time, not by a live failure.

One internal caller needed updating: `get_venue_analytics()` (the existing, unmigrated `/analytics` page's RPC) called `canonical_conversion_funnel()` with zero args internally. Updated to pass explicit nulls (`canonical_conversion_funnel(null, null)`) — same all-time behavior, nothing else in that function touched. Verified live (§10) that `/analytics`'s own RPC still returns correctly post-migration — that page was read for reference (its own legacy `leadFunnel.conversionRate` was left completely alone, per the brief's explicit "do not reopen the metric definitions") but not otherwise modified.

`getGrossBookedRevenueByCategory()` had the same gap (no window) and got the same treatment — now optionally windowed on `booked_at`, the exact field/semantic `canonical_gross_booked_revenue()` itself already windows on, so a Revenue report's category breakdown always sums to the same total as its own headline number for the same range.

## 6. Sales report

`app/(app)/reporting/sales/page.tsx`. Three sections:
- **Conversion Funnel** — the canonical seven stages, each stage's own established name (never all called "Conversion Rate" — only "Booking Conversion Rate" carries that name, per the Registry's own rule), count + drop-off percentage between stages, a plain bar-width visual plus the number (never bar-only).
- **Leads Received** — a trend chart, from `lib/reporting/service.ts:getLeadsTrend()`, plain `COUNT(leads)` grouped by month, not a funnel/conversion calculation.
- **Lead Sources** — source, total leads, resulting bookings, rate — using `lib/leads/constants.ts:sourceLabel()` for venue-friendly labels (Website, Referral, Instagram, etc.) from the actual existing source catalog, never internal source IDs. The "booked" count reuses the identical `canonical_bookings` → `clients.lead_id` join `lib/metrics/booking.ts:getBookingsByLeadSource()` already established — this page's own version is windowed and grouped alongside total-leads-per-source in one pass rather than two separate calls, not a second formula.

## 7. Bookings report

`app/(app)/reporting/bookings/page.tsx`. Bookings count + comparison, Booked Revenue (linked through to Revenue for the full breakdown), Average Booking Value + comparison, a Bookings Over Time trend (bucketed from the same canonical rows the count itself uses), a "Bookings by Coordinator" card showing **"Coming later — there isn't yet a way to record which staff member is responsible for a booking"** (per the Registry's own `canonical_pending`/`blockedReason` — not faked, not inferred from `created_by`/current owner/last editor), and a click-through detail list (client name + booked date → `/clients/{clientId}`, the existing Relationship Workspace).

Booking Forecast does not appear anywhere in this report or anywhere else in Reporting — no methodology exists in the Registry, and none was invented.

## 8. Revenue report

`app/(app)/reporting/revenue/page.tsx`. Four `ComparisonCard`s (Gross Booked Revenue, Payments Collected, Outstanding Balance, Average Booking Value) each with its own one-line plain-language explanation (brief §50) so "Revenue" is never one ambiguous number — a Revenue Trend (Gross Booked Revenue by month, windowed on `booked_at`), and Revenue by Category using the exact 11 certified categories, with a percentage-of-total bar per category.

## 9. Events report

`app/(app)/reporting/events/page.tsx`. Event count + comparison, an Events Over Time trend (by `event_date`), Event Types (grouped by `events.event_type`, labeled via the existing `eventTypeLabel()`), and a click-through detail list to `/clients/{clientId}`. Deliberately not a calendar — no day/week/month grid, no scheduling affordance; a report row is a report row (brief §27/§67).

## 10. Date-range model

One shared resolver, `lib/reporting/date-range.ts`, used by every report page identically (brief §68 — no "From/To" on one report and "Period" on another):

- Presets: This Month, Last Month, This Quarter, Last Quarter, This Year, Last Year, Custom Range.
- Every preset resolves to `{ from, to, label, previousFrom, previousTo, comparisonLabel }` — the label is always spelled out ("Jan 1 – Jan 31, 2026," brief §13), and the comparison period is always the *immediately preceding, equal-length* period (this month vs. the month before, this quarter vs. the quarter before, etc.) — never a misleading mismatched-length comparison (brief §14). A custom range's comparison period is an equal-length window immediately before it.
- URL-search-param-driven (`?range=this_month`): each report page is a Server Component reading `searchParams` directly, so every report responds to the same control with a real server re-fetch — no client-side cache that could leak one venue's filter state into another session (brief §59/§60 — there is no module-level state anywhere in this phase's code).
- `components/reporting/report-tabs.tsx` preserves the current range's search params on every tab link, so switching from Sales to Revenue keeps "This Quarter" active rather than resetting it.

## 11. Comparison model

`components/dashboard-system/comparison-card.tsx` — the canonical Comparison Card the Dashboard Component System's own Phase 2 report named as a genuine missing family, built now because Reporting is its first real consumer. Primary value, comparison value, direction (arrow + always an accessible text sentence — "18% higher than last month," never arrow/color alone, brief §15/§52/§72), and a `polarity` prop the caller sets explicitly (`up-good` / `up-bad` / `neutral`) — "up" is never assumed to be good news (Outstanding Balance going up is bad). When the prior period genuinely has no data, the card says so ("No data for the prior period") rather than fabricating a 0% change.

## 12. Filter model

Only two real, supported filters were built into the UI: date range (every report) and the Lead Source / Event Type / Revenue Category *breakdowns* themselves (shown as report sections, not a generic filter builder — brief §30 explicitly forbids inventing one). No "Add Filter" UI, no exposed database columns.

## 13. Drill-down behavior

Every list row in Bookings and Events links to `/clients/{clientId}` — the existing Relationship Workspace, unchanged. Reporting never renders a second event/booking management surface; clicking a row navigates away from Reporting entirely into the real workspace (brief §28/§29).

## 14. Component reuse

- `StatTile`/`DashboardCardShell`/`SEVERITY_CONFIG` — read, understood, deliberately **not** used directly in Reporting's summary cards (Comparison Card needed a comparison-value slot StatTile doesn't have) — but `ComparisonCard` follows the exact same visual language (`Card`/`CardContent`, the same severity-derived color discipline) rather than inventing a new one.
- `TrendChart` (`components/dashboard-system/trend-chart.tsx`) — new. No chart library exists anywhere in this codebase (confirmed by search — every prior "LineChart"/"BarChart" hit was a lucide icon, never an actual chart). One simple, shared flexbox bar chart, reused by Sales/Bookings/Revenue/Events rather than four bespoke ones.
- `ComparisonCard` — new, the one genuinely missing family, built once and reused four times.
- No `RevenueCard`, `BookingsCard`, or `ConversionCard` one-off primitives were created — every report composes `ComparisonCard`/`TrendChart`/plain `Card` sections instead (brief §44/§45).

## 15. Security / permissions

- Every canonical function reads venue from the caller's own session via `current_user_venue_id()` — never a caller-supplied parameter (unchanged; this phase added parameters for *dates*, never for venue identity).
- Role access: verified the existing product has **no** financial-visibility restriction by role anywhere else in the app (Payments/Invoices pages are open to all four roles today) — so Reporting inherits that same, already-established access model rather than inventing a new Reporting-specific permission system, per the brief's own "do not invent a new Reporting permission system unless the existing product explicitly requires one."
- HQ Analytics (`app/admin/analytics`) was not touched, read, or linked from Reporting — completely separate, cross-venue administrative scope preserved exactly as-is.

## 16. Financial integrity

No report page, action, or server function in this phase writes to `invoices`, `payment_line_items`, `payment_schedules`, `contracts`, or `events`. Every Reporting function is a `select`/RPC-read. Confirmed by inspection of every file listed in §17 below — none contains an `insert`/`update`/`delete` on a financial or booking table.

## 17. Performance

No client-side aggregation of raw rows. Every report is server-rendered per request from a small number of scoped Supabase queries (canonical RPCs return one number each; the heaviest read, Revenue Trend, fetches at most a venue's bookings + their invoices for the selected window — not the whole table). No elaborate warehouse, no pre-aggregation layer — the simplest architecture that performs correctly at this product's current scale, per the brief's own instruction.

## 18. Mobile behavior

`ComparisonCardGrid` stacks to one column on mobile (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`). `TrendChart` is a flexbox layout that reflows naturally; value labels are always visible (not hover-only — an earlier draft used hover-reveal labels and was corrected specifically because hover doesn't exist on touch). The date-range control and report tabs both wrap/scroll horizontally rather than overflowing. No live device test was performed (no browser automation tool available this session) — verified via responsive class review only. Stated plainly rather than claimed as fully device-tested.

## 19. Accessibility

`TrendChart` carries a full `role="img" aria-label"` text description of every point (label + value), not just a visual bar. `ComparisonCard` always renders its direction as a text sentence, never color/arrow alone. Severity/direction color always pairs with text.

## 20. End-to-end validation

Real, authenticated, against controlled real dev data (not an empty database — brief §55). Test scenario: 2 canonical Bookings in two different months (with signed contracts, paid deposits, invoices with 4 different revenue categories, and outstanding balances), 1 proposal-stage lead, 1 lost lead, across 2 lead sources, plus 2 events with different types/dates. 22/22 checks pass:

| # | Check | Result |
|---|---|---|
| 1a–d | Gross Booked Revenue / Payments Collected / Outstanding Balance / Average Booking Value, windowed to one month only, exactly match hand-computed expected values ($7,500 / $1,500 / $6,000 / $7,500) | PASS |
| 2a–d | Same four metrics, windowed to both months, exactly match ($16,500 / $2,500 / $14,000 / $8,250) | PASS |
| 3a | A date range with no real activity returns `0`, not an error or the all-time total | PASS |
| 4a–c | Conversion funnel, windowed to one month: inquiry/booked/conversion-rate exactly match | PASS |
| 4d–h | Conversion funnel, windowed to both months: proposalSent/contractSigned/booked exactly match this test's own data (no leakage from other real leads already in this shared dev venue); bookingConversionRate correctly derived from the RPC's own reported counts | PASS |
| 4i | Funnel with a `null` window still returns correct all-time counts (backward compatible) | PASS |
| 5a–b | `canonical_bookings` windowed to one vs. both months returns exactly 1 vs. 2 clients | PASS |
| 6a–b | A different venue's Gross Booked Revenue / funnel do not include this venue's test data | PASS |
| Regression | `get_venue_analytics()` (the existing `/analytics` page's RPC) still returns successfully after the funnel-signature migration | PASS |
| Build | Full-project `tsc --noEmit` — zero errors introduced by this phase | PASS |
| Live | `/reporting`, `/reporting/sales`, `/reporting/bookings`, `/reporting/revenue`, `/reporting/events` all route correctly (307 to login, no 500s) | PASS |

**Not performed**: an authenticated browser click-through of the actual report pages, or a live mobile-device check — no browser automation tool was available in this environment. Verified instead via clean typecheck, the RPC-level cross-checks above (which exercise the exact same canonical functions and windowing logic every report page calls), and responsive-class review. Stated explicitly rather than claimed as done.

## 21. Negative tests

| Check | Result |
|---|---|
| Venue A's Gross Booked Revenue does not include Venue B's bookings | PASS (§20, 6a) |
| Venue A's conversion funnel does not include Venue B's leads | PASS (§20, 6b) |
| An out-of-range date window returns `0`, not a fallback to all-time or an error | PASS (§20, 3a) |
| Reporting cannot mutate financial records | PASS by construction — every function in `lib/reporting/service.ts` and every canonical function called is read-only (§16) |
| Reporting cannot mutate booking state | PASS by construction — same reasoning |
| Stale/cross-request state cannot leak between venues | PASS by construction — no module-level mutable state anywhere in this phase; every value is computed fresh per request from `current_user_venue_id()`-scoped queries |

## 22. Known limitations / deferred capabilities

- **Bookings by Coordinator** — deferred, exactly as the Registry established: no structured field associates a Client/Lead/Event with a responsible staff member. Shown as "Coming later" in the Bookings report, not faked.
- **Booking Forecast** — deferred, exactly as the Registry established: no approved forecasting methodology exists. Does not appear anywhere in Reporting.
- **Export** — the existing product has no general report-export capability today (confirmed by inspection — no CSV/export utility exists for analytics data). Per the brief's own instruction ("do not automatically build a large export system in R1 unless clearly required"), none was built. A polished on-screen report was prioritized instead.
- **Print/PDF** — not built, per the brief's own explicit instruction not to build a generic reporting PDF engine in R1.
- **Mobile/accessibility** — verified via responsive-class review and semantic markup, not a live device/browser test (no browser automation tool available this session).
- **Luv** — no integration; Reporting functions completely independently, per the brief's own scope boundary.

## Required PASS/FAIL matrix

| Capability | Status |
|---|---|
| Reporting navigation | PASS |
| Reporting Overview | PASS |
| Date range | PASS |
| Period comparison | PASS |
| Canonical Metric Registry usage | PASS |
| Bookings report | PASS |
| Booked Revenue | PASS |
| Payments Collected | PASS |
| Outstanding Balance | PASS |
| Average Booking Value | PASS |
| Revenue by Category | PASS |
| Revenue trend | PASS |
| Sales report | PASS |
| Canonical conversion funnel | PASS |
| Lead Source report | PASS |
| Booking trend | PASS |
| Events report | PASS |
| Drill-down | PASS |
| Empty states | PASS |
| Loading states | N/A — Server Component pages render synchronously per request; no client-side loading state was needed (no stale-data-while-fetching scenario exists to guard against) |
| Error states | PASS — canonical functions return `null`/`0` distinctly from a thrown error; no report silently shows a false zero on a real query failure |
| Mobile | PASS (responsive-class review; no live device test — see §18) |
| Accessibility | PASS (text-based direction/trend descriptions; no live screen-reader test — see §19) |
| Role permissions | PASS (inherits existing product-wide access model — see §15) |
| Cross-venue isolation | PASS |
| Financial integrity | PASS |
| Dashboard separation | PASS |
| Performance | PASS (server-scoped queries, no client-side aggregation) |
| No duplicate metric formulas | PASS |
| End-to-end validation | PASS |
