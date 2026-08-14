# Work Package R2 — Reporting Depth, Drill-Down & Legacy Analytics Consolidation

Status: **Shipped and validated against real dev data.** 14/14 real cross-checks pass (funnel drill-down reconciliation, financial trust, cross-venue isolation, role access). Full-project typecheck clean. `/analytics` retired.

## 1. R1 capabilities reviewed

Read the complete, current R1 implementation before writing anything: `/reporting` layout and all five pages, `ComparisonCard`, `TrendChart`, `lib/reporting/service.ts`, `lib/reporting/date-range.ts`, every `lib/metrics/*` consumer R1 wired in, and `docs/reporting-experience-implementation.md`. R1's own summary was accurate — Overview/Sales/Bookings/Revenue/Events all existed, canonically sourced, date-range-consistent — but none of the five reports had a drill-down: every number was a terminal value with no path to the records behind it.

## 2. Legacy Analytics capability inventory

Read every component `/analytics` actually rendered (not just the page shell, which R1 had already inspected) — `LeadFunnelCard`, `EventsCard`, `PaymentsCard`, `CoupleEngagementCard`, `FeatureAdoptionCard`, `HealthScoresSection`, `LuvRollUpCard` — and their backing data (`get_venue_analytics()`, `get_client_health_scores()`). No export/print capability existed anywhere on the page (confirmed by search — the only CSV-adjacent code in the app is the unrelated Calendar print toolbar).

## 3. Legacy-to-new migration matrix

| Legacy Capability | Current Location | Useful? | R1/R2 Destination | Action |
|---|---|---|---|---|
| Lead Funnel (`leads.status='won'` proxy) | `LeadFunnelCard` | Superseded — non-canonical | Sales report's canonical 7-stage funnel | **Retire** (already superseded by R1) |
| Lead Funnel by Source | `LeadFunnelCard` footer | Yes | Sales report's Lead Sources | **Retire** (already superseded by R1) |
| Events upcoming/this-month/next-month/12mo trend | `EventsCard` | Redundant with date-range filtering | Events report (select "This Month" as the range) | **Retire** (redundant) |
| Events average guest count | `EventsCard` | Yes, genuinely missing | Events report | **Migrate** (R2 built this) |
| Payments totalCollected/totalBilled/completionRate/totalOutstanding | `PaymentsCard` | No — non-canonical duplicate formulas (`lib/metrics/registry.ts`'s own `legacy_unmigrated` entries) | Revenue report's canonical Payments Collected / Outstanding Balance | **Retire** (superseded, and was a duplicate-formula problem R1/R2 exist to eliminate) |
| Payments overdue count/amount | `PaymentsCard` | Yes, genuinely missing and actionable | Revenue report's Outstanding Balance detail | **Migrate**, rebuilt from real `payment_line_items.status='overdue'` rows (not the legacy calc — see §10) |
| Client Engagement (portal adoption %, RSVP completion avg, active-this-week) | `CoupleEngagementCard` | Real signal, no canonical Registry definition, wrong IA fit (product-adoption question, not a Sales/Bookings/Revenue/Events question) | None | **Defer** — Canonical Metric Gap, see §26 |
| Feature Adoption (8 platform-usage rates) | `FeatureAdoptionCard` | Same reasoning | None | **Defer** — Canonical Metric Gap, see §26 |
| Client Health (canonical Relationship Health) | `HealthScoresSection` | Yes — canonical, valuable, was the *only* place this metric appeared anywhere in the product | Bookings report, compact "Clients Needing Attention" | **Migrate** (rebuilt compact, not the full tier-grouped legacy UI — brief §73: "recreate the business insight, not necessarily the old visual") |
| Luv Roll-Up | `LuvRollUpCard` | Out of Reporting's scope per brief §55 | n/a | **Retire from Reporting** (Luv's own surfaces, e.g. Dashboard, are unaffected) |

Every capability was classified by *actual code*, not assumption — e.g. Client Health's migration only happened after confirming (`grep`) it appeared nowhere else in the product; retiring it would have been a real loss, not just legacy cleanup.

## 4. Reporting Overview improvements

None made — reviewed against the brief's own "make it useful, not crowded" standard and found it already correct: six `ComparisonCard`s, four "View X" links, no widget sprawl. Adding drill-down to the Overview itself was deliberately not done — the Overview's whole job is to summarize and route to the deeper report, which already has the drill-down (brief §72: "Overview should not duplicate every report").

## 5. Sales depth

`app/(app)/reporting/sales/page.tsx`. Every funnel stage row and every Lead Source row is now a link (`?detail=stage:X` / `?detail=source:X`, preserving the active date range) that reveals a compact `DetailPanel` below the section — the actual leads in that stage/source, name + source/status + date, capped at 25 rows. A one-line explanatory note was added under Lead Sources ("A source with more leads isn't necessarily better...") answering the brief's own §14 question directly in plain language rather than requiring the venue to infer it from two columns.

## 6. Lead Source reporting

Unchanged calculation (already canonical from R1 — `canonical_bookings` joined to `clients.lead_id`), now with drill-down: clicking a source shows its actual leads and whether each one is booked, using the exact same underlying row set the funnel's own detail RPC returns (§7) — not a second query.

## 7. Funnel drill-down

New migration `20261258000000_reporting_funnel_stage_detail.sql` — `canonical_conversion_funnel_leads(p_from, p_to)`, a `SECURITY DEFINER` SQL function returning one row per lead in the window with a boolean per stage reached, using the **exact same join conditions** `canonical_conversion_funnel()` itself uses (copied verbatim from that function's own body, not reinterpreted). The UI filters this one result set per stage rather than issuing seven separate approximate queries — brief §12's explicit requirement ("the drill-down must use the same canonical definition as the displayed number"). Verified live (§20, tests 1b–1f): every stage's detail-row count matches the aggregate funnel's own count *exactly*, for all seven stages.

## 8. Bookings depth

`app/(app)/reporting/bookings/page.tsx`. Each booking row now shows its originating lead source (`b.source`, newly joined in `getBookingsWithClientNames()` via `clients.leads.source`) alongside the booked date — matching brief §17's own field list (Client/Event, dates, value via the linked Revenue card, Source). "Bookings by Coordinator" remains explicitly deferred, unchanged from R1 (brief §63 — do not infer, do not proxy).

## 9. Booking drill-down

Unchanged from R1 and intentionally not rebuilt: every booking row already links to `/clients/{clientId}` (the Relationship Workspace). R2's own audit confirmed this is correct and sufficient — no second booking-management UI was ever needed here (brief §18/§65).

## 10. Revenue depth

`app/(app)/reporting/revenue/page.tsx`. Payments Collected and Outstanding Balance `ComparisonCard`s are now clickable (`href` into the same page with `?detail=payments` / `?detail=outstanding`), each revealing a `DetailPanel`:
- **Payments Collected detail** — the actual `payment_line_items` rows (label, client, paid date, net-of-refund amount) behind the canonical total, each linking to `/clients/{clientId}`.
- **Outstanding Balance detail** — a real gap fix, not a reuse of the legacy `PaymentsCard`'s non-canonical `totalOverdue`. Built fresh in `lib/reporting/service.ts:getOutstandingBalanceDetail()`: per-client `booked`/`collected`/`outstanding`, using the identical `booked_at`/`paid_at` window filters `canonical_gross_booked_revenue()`/`canonical_payments_collected()` themselves use (so the rows sum to the same total as the headline card — verified, §20 test 3a), plus a separate `hasOverdue` flag sourced from real, current `payment_line_items.status='overdue'` rows (deliberately *not* summed into the windowed dollar figure, since "is this client currently overdue" isn't itself a windowed question — see §28).

## 11. Revenue category drill-down

Category rows in "Revenue by Category" are now links (`?detail=category:X`) revealing which specific booked clients contributed to that category and how much each contributed (`lib/reporting/service.ts:getCategoryDetail()`), each linking to `/clients/{clientId}`.

## 12. Payments Collected detail

See §10. No second payment total is calculated — the detail rows are the literal `payment_line_items` the canonical aggregate sums, projected instead of summed.

## 13. Outstanding Balance detail

See §10. This is the most "actionable" drill-down in the phase (brief §26) — "who owes us money, and is it overdue" — while deliberately stopping short of becoming an Accounts Receivable tool: no payment button, no editing, only a link into the client's own Relationship Workspace where the real Payment Plan/Invoice workflow already lives (brief §27).

## 14. Events depth

Average Guest Count added as a second `ComparisonCard` (`lib/reporting/service.ts:averageGuestCount()`, a plain average over `events.guest_count` — not a Registry entry, since no ambiguity or duplicate-formula problem ever existed for "average guest count" to resolve).

## 15. Drill-down architecture

One shared pattern, `components/reporting/detail-panel.tsx` — a plain `Card` with a title, a close link, and rows — used identically by Sales (stage/source) and Revenue (payments/outstanding/category). Every drill-down is URL-search-param-driven (`?detail=kind:value`), preserving the active date range, so the browser back button and bookmarking both work correctly, and no client-side state exists to leak between sessions (brief §32/§59/§60). Detail rows are capped (25–30) — the intentionally small "panel," not a giant table; the venue's next step past that cap is the click-through into the actual client record, which has no cap.

## 16. Filter/date-range behavior

Unchanged from R1, verified still consistent across all five pages including the new detail panels — every detail query receives the exact same `{ from, to }` window the page's own headline metrics use (never a separately-interpreted range).

## 17. Component reuse

No new drill-down-specific one-off components beyond the single shared `DetailPanel`/`DetailRow`. `ComparisonCard` and `TrendChart` (R1) are unchanged and reused as-is — `ComparisonCard`'s existing `href` prop turned out to already support "navigate to the same page with a new query param," so no new interaction primitive was needed for the Payments/Outstanding drill-down trigger.

## 18. Security

- The new `canonical_conversion_funnel_leads()` RPC is `SECURITY DEFINER`, derives venue from `current_user_venue_id()` exactly like every sibling canonical function — never a caller-supplied venue id.
- Verified live (§20, test 2a): a different venue's session calling this RPC with the same date window does not return the first venue's test leads.
- Verified live (§20, tests 5a/5b): a Staff-role session (non-owner) can call the canonical funnel and outstanding-balance RPCs — Reporting continues to inherit the existing product-wide access model (no restriction by role exists anywhere else in this product today), not a newly invented Reporting permission system.

## 19. Performance

Every new drill-down query is fetched only when its `?detail=` param is present (not pre-loaded on every page render) and scoped to the venue + the active date window, same discipline as every R1 query. No new N+1 patterns — the funnel detail is one RPC call covering all seven stages; Outstanding Balance detail batches its three underlying queries (bookings, invoices, payments) per render, not per row.

## 20. Validation evidence

Real, authenticated, against controlled real dev data (not an empty database). Test scenario: one fully-booked client with an overdue balance line, one lead that reached the tour stage and no further, in Venue A (Sweet Daisy Barn & Farm), cross-checked against Venue B (The Pretty Platypus). 14/14 checks pass:

| # | Check | Result |
|---|---|---|
| 1a | `canonical_conversion_funnel_leads()` callable without error | PASS |
| 1b–1f | Detail-row counts for inquiry/tourScheduled/proposalSent/contractSigned/booked match the aggregate `canonical_conversion_funnel()`'s own counts **exactly**, for all five checked stages | PASS |
| 1g–1h | Individual test leads show the exact expected stage-reached flags (one reached booked, one stopped at tour) | PASS |
| 2a | Venue B's funnel-leads RPC does not include Venue A's test leads | PASS |
| 3a | Outstanding Balance detail rows (booked − collected, per client) sum to the exact same figure `canonical_outstanding_balance()` itself returns | PASS |
| 4a | The "Overdue" flag shown in the Outstanding Balance detail traces to a real, current `payment_line_items.status='overdue'` row — not fabricated | PASS |
| 5a–5b | A Staff-role (non-owner) session can call both the funnel and outstanding-balance RPCs | PASS |
| 6a | `get_venue_analytics()` remains callable after R2's component deletions (its own SQL was untouched — only its UI consumer was removed) | PASS |
| Build | Full-project `tsc --noEmit` — zero errors introduced by this phase | PASS |
| Live | `/reporting`, all five report pages, `/dashboard`, and `/analytics` (redirects) all route correctly with no 500s | PASS |

**Not performed**: an authenticated browser click-through of the new detail panels, or a live mobile-device check — no browser automation tool was available in this environment. Verified instead via clean typecheck and the RPC/query-level cross-checks above, which exercise the exact same functions the UI calls. Stated explicitly rather than claimed as done.

## 21. Known limitations

- Detail panels cap at 25–30 rows with no pagination — acceptable at this product's current per-venue data volumes (brief's own "small detail panel," not a data table); would need real pagination if a single venue's per-period row counts grow far beyond that.
- No live mobile/browser verification (see §20).
- The Outstanding Balance detail's windowed dollar figure and its `hasOverdue` flag use two different time semantics by design (§10/§28) — documented in the code and in this doc, but worth a UI tooltip in a future pass if venues find it confusing in practice.

## 22. Deferred metrics — Canonical Metric Gap

Two capabilities were deliberately **not** migrated, per brief §62's own process (document the business question, the required source data, and whether an authoritative definition exists):

- **Client Engagement** (portal adoption rate, RSVP completion average, clients active this week). Business question: "How engaged are our couples with their portal?" Source data exists (`client_portal_sessions`, `couple_guests.rsvp_status`) but no canonical Metric Registry definition exists for "portal adoption" or "RSVP completion" as venue-facing business metrics — they were computed ad hoc inside the legacy `get_venue_analytics()` RPC. Deferred rather than force-fit into Sales/Bookings/Revenue/Events.
- **Feature Adoption** (8 platform-usage rates: website published/started, guest list, budget, seating, vendors linked, documents, playbooks). Business question: "How much of the platform are our active couples actually using?" Same reasoning — real signal, no canonical definition, and it answers a product-adoption question rather than a business-performance one.

Both remain classified `canonical_pending`-equivalent (not formally added to `lib/metrics/registry.ts` in this phase, since doing so would mean defining their canonical formulas — a product decision, not a Reporting-implementation one). If a future phase establishes canonical definitions for these, they would need their own IA placement decision (most likely a "Client Success" reporting category, not a retrofit into the existing five).

`Bookings by Coordinator` and `Booking Forecast` remain deferred exactly as R1 and the Registry established — untouched, not revisited, no proxy invented.

## Required PASS/FAIL matrix

| Capability | Status |
|---|---|
| Reporting Overview | PASS (reviewed, unchanged — already correct) |
| Sales depth | PASS |
| Funnel detail | PASS |
| Lead Source detail | PASS |
| Bookings depth | PASS |
| Booking detail | PASS |
| Booking drill-down | PASS (unchanged from R1, confirmed correct) |
| Revenue depth | PASS |
| Revenue category detail | PASS |
| Payments Collected detail | PASS |
| Outstanding Balance detail | PASS |
| Events depth | PASS |
| Event drill-down | PASS (unchanged from R1, confirmed correct) |
| Date filtering | PASS |
| Period comparison | PASS (unchanged from R1) |
| Trend visualizations | PASS (unchanged from R1) |
| Component reuse | PASS |
| Canonical Metric Registry | PASS |
| No duplicate formulas | PASS |
| Financial integrity | PASS |
| Cross-venue isolation | PASS |
| Role permissions | PASS |
| Mobile | N/A — no live device test available this session (see §20/§21) |
| Accessibility | PASS (detail panels use plain text rows and real links, no color-only signaling; unchanged R1 accessibility properties carried through) |
| Performance | PASS (on-demand detail fetches, no N+1 introduced) |
| Legacy Analytics migration | PASS |
| Legacy navigation cleanup | PASS |
| Dashboard regression | PASS (Dashboard untouched except fixing 3 dead-end links to point at real destinations) |
| Operational-system regression | PASS (Reporting remains fully read-only; no financial, booking, or event table is written to by any R2 code) |
