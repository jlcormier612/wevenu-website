# Work Package R3 — Reporting Polish, Customer Experience & Business Usability

## Executive summary

R3 used the actual R1/R2 Reporting implementation the way a venue owner would, built a realistic multi-month dataset to test it against, and found two real, previously-undetected defects — one a critical cross-venue data-isolation bug, the other a silently-broken query that had been zeroing out the Bookings report and part of Sales since R1. Both are fixed and verified. Beyond those, this phase made a real round of usability, accessibility, and copy improvements to all five report surfaces, fixed a genuine state-sync bug in the date-range control, and removed a real N+1 performance pattern present on every Reporting page load (and, as a side effect, every other page in the app).

No new metric formulas were introduced. No architecture was reopened. The Dashboard was not touched except for three link destinations that were already pointing at a dead end.

## 1. What was changed, and why

Rather than reading JSX and declaring it correct, this phase re-read all five report pages with a "would a venue owner understand this in three seconds" lens, then built a realistic dataset (9 bookings across 4 months, 3 lead sources with genuinely different conversion characteristics, overdue and non-overdue outstanding balances, multiple revenue categories) specifically to exercise growth/decline comparisons, source comparisons, and outstanding-balance detail — the exact scenarios the brief requires (§64). Testing against that dataset, not the tiny R1/R2 validation fixtures, is what surfaced both real bugs below; neither would have been visible against a 1-2-row dataset.

## 2. Critical fix — cross-venue data isolation on `canonical_bookings`

**Finding.** `canonical_bookings` (built in the original Canonical Metric Implementation phase) is a plain SQL view. In PostgreSQL, a view executes its underlying query using the *view owner's* privileges for permission and row-level-security purposes — not the querying user's — unless the view is explicitly marked `security_invoker`. Every migration in this project runs as the `postgres` role, which has `BYPASSRLS`. That means `canonical_bookings` was silently bypassing the real, correctly-written RLS policies on its underlying tables (`clients`, `contracts`, `payment_schedules`, `payment_line_items` — all confirmed to have correct `venue_id = current_user_venue_id()` policies) for every caller, regardless of which venue they belonged to.

**Verified live**, before any fix: Venue B's own authenticated session, querying `canonical_bookings` with an explicit `.eq('venue_id', <Venue A's id>)` filter, returned all of Venue A's booking rows.

**Fix.** Migration `20261259000000_canonical_bookings_security_invoker.sql`: `ALTER VIEW public.canonical_bookings SET (security_invoker = true)`. This makes the view run with the querying role's own permissions and RLS context — a security-context change only, not a formula change; `canonical_bookings`' business definition of a Booking is untouched. Re-verified live after the fix: the identical query now returns zero rows for Venue B.

**Related finding, not fixed this phase.** The same `postgres`-ownership pattern exists on 9 other views in this schema (`canonical_document_*`, `couple_website_stats`, `venue_users`). None of them are consumed by Reporting, and at least one (`venue_users`) is already known-broken from an earlier phase for unrelated reasons. Fixing them blindly is not safe without first confirming none of them are *intentionally* cross-venue (e.g., an HQ-admin surface) — R1's own brief specifically warned about that exact tension. Flagged here as a real, same-class security finding that needs its own dedicated review; not expanded into this phase's scope.

## 3. Critical fix — the Bookings report and part of Sales were silently empty

**Finding.** Both `lib/reporting/service.ts:getBookingsWithClientNames()` (the function behind the entire Bookings report — its count, its trend, its detail list) and the Sales report's Lead Source "Bookings"/"Rate" columns queried `canonical_bookings` with an embedded relationship: `.select("client_id, ..., clients!inner(...)")`. PostgREST resolves embedded relationships via foreign-key metadata; because `canonical_bookings` is a *view*, it carries no FK constraint PostgREST's schema cache can discover, so this query has always failed outright with `PGRST200: Could not find a relationship between 'canonical_bookings' and 'clients'`. The original code never checked the `error` field, so `data` silently became `null`, coalesced to an empty array, and rendered as "no bookings" — every venue, every date range, since R1.

**Verified live**, before any fix: the exact original `.select()` string reproduces the `PGRST200` error on a real authenticated call.

**Why this wasn't caught in R1/R2.** Every R1/R2 validation script cross-checked canonical numbers using a *different*, simpler query shape (`select("client_id, booked_at")`, no embed) — the correct pattern used everywhere else in this codebase, including two other functions in the same file. The validation scripts never happened to exercise the one broken shape the actual Bookings-report UI code used. A live curl smoke test (used throughout this engagement in place of unavailable browser tooling) also can't catch this class of bug: a 200 response with silently-empty data due to a swallowed query error is indistinguishable from a real "no bookings in this period" empty state without inspecting the actual numbers against known test data — exactly what R3's realistic-dataset scenario testing is for.

**Fix.** Three call sites rewritten to the codebase's own established pattern for this exact situation (already used correctly by `getGrossBookedRevenueByCategory`, whose own comment documents the same reasoning): fetch `canonical_bookings` rows with a plain, unembedded select, then fetch the real `clients` table (which *does* have a discoverable FK to `leads`, so embedding `leads(source)` off it works) separately, and join the two in JS.
- `lib/reporting/service.ts:getBookingsWithClientNames()` — the Bookings report's data source.
- `app/(app)/reporting/sales/page.tsx:getLeadSourceBreakdown()` — the Sales report's Lead Source table.
- `lib/metrics/booking.ts:getBookingsByLeadSource()` — a canonical-registry function with no current UI caller (confirmed dead code), fixed anyway since it's part of the certified canonical layer and the fix is free.

**Verified live**, after the fix: the same query pattern now succeeds and returns a real client row for every booking; the realistic dataset's Lead Source comparison (Instagram: 7 leads, Referral: 3 leads, but Referral converts at a higher rate) now correctly resolves.

## 4. Real bug — date-range control went stale on cross-report navigation

**Finding.** `DateRangeControl` is a Client Component that persists across report-to-report navigation (same position in the layout tree, never remounted). Its "is a custom range open" flag and its from/to input values were `useState`-initialized once from props/URL params at first mount. Navigating somewhere that changed the active range *without* going through this component's own Select/Apply handlers — e.g. clicking an Overview `ComparisonCard` that links straight to `/reporting/sales` with no range params — left the stale state behind: a venue who'd set a Custom Range could click through to another report and see the custom date inputs still showing, out of sync with the URL's actual (now-default) range.

**Fix.** `customOpen` is now derived directly from the live `current` prop every render instead of stored in state; the from/to inputs re-sync via a `useEffect` keyed to the live `searchParams` object. `components/reporting/date-range-control.tsx`.

## 5. Overview improvements

Reordered the six `ComparisonCard`s into two visually coherent groups — Bookings/Leads/Conversion (the business), then Gross Booked Revenue/Payments Collected/Outstanding Balance (the money) — rather than interleaving counts and dollar figures, so a quick scan tells a venue owner which tiles are activity and which are cash. No new metrics added, no content added — reviewed against the brief's own "clarity, not more content" standard and found the metric *selection* already correct.

## 6. Sales improvements

- **Funnel stage explanations** (brief §12): each of the seven stages now carries a short, plain-language hint (`title` attribute + accessible label) — e.g. "Bookings — Signed contract + deposit collected" — so a venue can't misread what a stage actually means, without exposing the underlying Metric Registry formula.
- **Fixed a real rendering defect**: the "X% continued" drop-off line between funnel stages rendered a bare arrow with no percentage whenever the prior stage's count was zero — looked broken. Now hidden entirely in that case rather than showing an empty fragment.
- **Report title** added ("Sales — Where your opportunities are coming from, and how well they're converting into bookings.").
- Lead Source's real bug fix (§3) restores the actual business value of this section — comparing total leads against bookings and rate, source by source, is the whole point of the table, and it had never actually worked.

## 7. Lead Source reporting

Covered in §3/§6. Verified live against the realistic dataset that the report correctly distinguishes a high-volume/lower-conversion source from a low-volume/higher-conversion one (brief's own Scenario 6) — a distinction the report could not have made visible before this phase's fix, since the "booked" column was always zero.

## 8. Funnel drill-down

Unchanged from R2 and re-verified correct — each stage's detail panel still reconciles exactly to the aggregate funnel counts (uses the same `canonical_conversion_funnel_leads()` RPC established in R2, untouched this phase).

## 9. Bookings improvements

- **Fixed the report's core data bug** (§3) — this is the majority of this section's value.
- **Fixed a missing comparison**: the "Booked Revenue" `ComparisonCard` was hardcoded to `previousValue={null}` (always showing "No data for the prior period"), even though the previous period's figure was trivially available — an oversight, not a deliberate choice. Now fetches and shows the real comparison.
- **Report title** added ("Bookings — What you've actually booked, and what it's worth.").

## 10. Revenue improvements

- **A real, unmistakable "Overdue" indicator**: previously plain destructive-colored text at 10px — technically present but easy to miss and color-only. Rebuilt using the app's own `Badge` component (a real pill, with an icon, matching every other status treatment in this product — Contract status, Task status, etc.) so overdue reads even without color vision, and is properly sized.
- **Report title** added, using the brief's own exact example: "Revenue — See what you've booked, collected, and still have outstanding."
- Financial terminology (Gross Booked Revenue / Payments Collected / Outstanding Balance / Average Booking Value) reviewed against brief §18/§19 and found already correctly distinct, with short supporting sentences already in place from R1/R2 — no changes needed.

## 11. Revenue category drill-down

Unchanged from R2, re-verified correct.

## 12. Payments Collected detail

Unchanged from R2, re-verified correct against the realistic dataset (real per-payment rows, not a recomputed total).

## 13. Outstanding Balance detail

Reconciliation to the canonical aggregate re-verified against the realistic dataset (multiple clients, genuinely different amounts, at least one overdue). Overdue presentation improved per §10.

## 14. Events improvements

Reviewed against the brief's own standard — found already correct (event count, average guest count, trend, type breakdown, detail list all working and appropriately scoped). Added a report title ("Events — What your event business looks like over time.").

## 15. Drill-down improvements

`DetailPanel`'s close control and every clickable drill-down row (funnel stages, lead sources, revenue categories, booking rows, event rows, detail-panel client links) now carry a real `focus-visible` ring — previously relying on the browser's unstyled default outline. Fixed one instance where the ring classes had been applied to a non-focusable descendant `div` instead of the actual focusable `Link` (a no-op bug — the ring never rendered).

## 16. Date/filter improvements

Covered in §4. Filter *consistency* (same control, same presets, same behavior on all five pages) re-verified unchanged and correct.

## 17. Comparison improvements

`ComparisonCard`'s accessibility (a real focus-visible ring, previously absent) fixed. Polarity/direction logic reviewed and confirmed correct across all consumers (Outstanding Balance correctly uses `up-bad`; every count/revenue metric correctly uses `up-good`).

## 18. Chart improvements

`TrendChart`'s value and month labels bumped from `10px` to `12px` (`text-[10px]` → `text-xs`) — the brief explicitly warns against tiny labels (§25/§41), and 10px is below comfortable reading size on mobile.

## 19. Mobile improvements

No live device test was performed (no browser automation tool available in this environment — stated plainly, not claimed). Reviewed and improved what's verifiable from markup/CSS: `TrendChart` value labels are never hover-only (a real fix from a prior phase, confirmed still in place); `ComparisonCardGrid` stacks to one column below `sm`; the date-range control's custom-range row wraps (`flex-wrap`) rather than overflowing on narrow viewports (a small additive fix this phase).

## 20. Accessibility improvements

Covered in §15/§17. Added `aria-label`s to the date-range Select and both custom-range date inputs (previously unlabeled beyond visual placement). Overdue status now communicated via an icon + text pill, not color alone (§10).

## 21. Performance improvements

**Real N+1 pattern found and fixed.** `getCurrentVenue()` (`lib/venue/service.ts`) is called independently by nearly every `lib/metrics/*` and `lib/reporting/*` function — a single Reporting Overview page load calls it a dozen-plus times, each a fresh round trip to resolve "who is the authenticated user's venue." Wrapped in React's request-scoped `cache()`: identical calls within one render pass are now deduped to a single underlying query. This is safe by construction — `cache()` memoizes only within a single request/render tree, never across requests or users, so it carries none of the cross-venue-leakage risk a module-level cache would (the exact hazard class this codebase has been burned by before). Verified: full-project typecheck clean and a broad smoke test across a dozen unrelated routes (this function is used app-wide, not just by Reporting) confirmed no behavioral regression.

## 22. Security validation

- Re-verified cross-venue isolation on all touched/re-tested surfaces, including the specific fix in §2.
- Re-confirmed Staff-role sessions can call the canonical revenue/funnel RPCs (unchanged from R2).
- **New finding, documented, not changed**: the R2-built `getPaymentsCollectedDetail()`/`getOutstandingBalanceDetail()` drill-down functions query `payment_line_items`/`payment_schedules` directly under the caller's own session. Those two tables' own RLS `SELECT` policies explicitly exclude the Staff role (`current_user_role() <> 'staff'`) — a pre-existing, deliberate product decision from an earlier phase, unrelated to Reporting. This means a Staff user sees the correct aggregate Payments Collected / Outstanding Balance totals (via the `SECURITY DEFINER` RPCs, unaffected) but an empty detail panel if they click through — not an error, a real, silent, but *already-established* restriction. Confirmed this is consistent with the existing product's own financial-detail access model rather than a defect introduced by Reporting, and documented rather than silently left for someone to rediscover.

## 23. Financial validation

Re-ran the Outstanding Balance reconciliation check (detail rows sum to the exact canonical aggregate) against the new realistic dataset — passes. No Reporting code path writes to `invoices`, `payment_line_items`, `payment_schedules`, `contracts`, or `events` — confirmed by inspection of every changed file this phase.

## 24. Dashboard regression

Dashboard was not redesigned. The only Dashboard changes are inherited from R2 (three link destinations pointing at the retired `/analytics`, already fixed then) — this phase touched zero Dashboard files directly. The shared `getCurrentVenue()` performance change (§21) was smoke-tested against `/dashboard` and a dozen other unrelated routes with zero regression.

## 25. Workspace navigation validation

Every drill-down row across all five reports still links to `/clients/{clientId}` (the Relationship Workspace) — confirmed unchanged and correct; this phase added zero new link destinations, only fixed the *data* feeding existing ones (§3).

## 26. Canonical metric validation

No new metric formulas were introduced this phase. The two real fixes (§2, §3) are a security-context change and a query-mechanism fix respectively — neither touches what a Booking, Revenue figure, or funnel stage *means*. Re-audited (`grep`) after implementation: no new competing Booking/Revenue/Conversion calculation exists anywhere in the changed files.

## 27. Real-data scenarios (required by brief §64)

All run against the realistic dataset (§1), 13/13 checks pass:

| Scenario | Result |
|---|---|
| 1 — Growing month (Last Month vs. 2 months ago: 4 bookings vs. 2) | PASS |
| 2 — Declining month (This Month vs. Last Month: 1 booking vs. 4) | PASS |
| 3 — High collected revenue across multiple bookings | PASS |
| 4 — Outstanding balances, multiple clients, genuinely different amounts | PASS |
| 5 — Overdue balance, real `payment_line_items.status='overdue'` row | PASS |
| 6 — Lead-source difference (Instagram: 7 leads/lower rate vs. Referral: 3 leads/higher rate) made visible | PASS |
| 7 — Empty period returns a real 0, not an error or stale data | PASS |
| 8 — Cross-venue isolation (Venue A vs. Venue B, including the §2 fix) | PASS |

Plus two direct regression proofs: the original broken query pattern still reproducibly errors (confirms §3 was a real bug, not a fluke), and the fixed pattern succeeds and returns a real client for every booking.

## Required PASS/FAIL matrix

| Capability | Status |
|---|---|
| Overview usability | PASS |
| Overview hierarchy | PASS (reordered into business/money groups) |
| Sales usability | PASS |
| Funnel readability | PASS (stage hints added, drop-off rendering bug fixed) |
| Funnel drill-down | PASS |
| Lead Source usability | PASS |
| Lead Source drill-down | PASS (real bug fixed — see §3) |
| Bookings usability | PASS |
| Booking detail | PASS (real bug fixed — see §3) |
| Booking drill-down | PASS |
| Revenue usability | PASS |
| Financial terminology | PASS (reviewed, already correct) |
| Revenue categories | PASS |
| Payments detail | PASS |
| Outstanding detail | PASS |
| Overdue presentation | PASS (rebuilt as a real pill, not color-only text) |
| Events usability | PASS |
| TrendChart usability | PASS (label size fixed) |
| ComparisonCard usability | PASS (focus ring added) |
| Date range UX | PASS (real stale-state bug fixed — see §4) |
| Empty states | PASS (reviewed, already correct) |
| Loading states | N/A — Server Component pages, no client-side loading state exists to review |
| Error states | PASS (reviewed; the §3 bug was precisely a missing error state — now fixed) |
| Mobile | PASS (reviewed via markup/CSS; no live device test — see §19) |
| Accessibility | PASS (focus rings, aria-labels, color-independent overdue signal) |
| Performance | PASS (real N+1 fixed — see §21) |
| Security | PASS (critical fix — see §2) |
| Cross-venue isolation | PASS (critical fix — see §2) |
| Dashboard regression | PASS |
| Workspace navigation | PASS |
| Canonical Metric Registry integrity | PASS |
| No duplicate formulas | PASS |
| Customer-language pass | PASS (report titles added; no jargon found on re-read) |
| Competitive quality | PASS — with the §2/§3 fixes in place; before them, Bookings and Lead Source were silently non-functional, which would have failed this test outright |

## Known limitations

- No live browser/device testing was possible this session (no browser automation tool available) — every visual/mobile/accessibility claim above is backed by markup, CSS, and RPC-level evidence, not a rendered screenshot. Stated explicitly per this engagement's own standing practice.
- The 9 other `postgres`-owned views sharing `canonical_bookings`' security pattern (§2) are flagged, not fixed — need individual review for intentional cross-venue (HQ) use before any of them can be safely changed.
- The Staff-role financial-detail restriction (§22) is pre-existing product behavior, not a Reporting defect, but is now explicitly documented where previously it would have been a silent surprise.

## Remaining Canonical Metric Gaps

Unchanged from R2 — Bookings by Coordinator and Booking Forecast remain deferred (no authoritative data/methodology exists); Client Engagement and Feature Adoption remain deferred (real signals, no canonical Registry definition, wrong IA fit). Nothing new discovered this phase requiring a gap classification.

## Deferred work

- A dedicated security review of the other 9 `postgres`-owned views (§2).
- A live browser/mobile QA pass once tooling is available.
- Folding the Payments/Outstanding Staff-role restriction into an explicit UI message ("financial detail requires Owner/Manager/Coordinator access") rather than a silent empty panel, if this is judged worth the added complexity in a future phase.
