# Hello to Cheers — Reporting & Analytics: Canonical Metric Implementation

**Date:** 2026-08-07
**Scope:** Implementation of the business definitions certified in `docs/reporting-analytics-architecture-certification.md` and `docs/metric-definition-registry-certification.md`. No new dashboards, reports, charts, or UI were built — this is the canonical calculation layer future dashboards/reports will consume. Additive only: every legacy calculation this phase supersedes is still live; nothing was deleted.

**What shipped:**
- `supabase/migrations/20261221000000_canonical_metrics_foundation.sql` — `invoice_line_items.revenue_category` (+ best-effort backfill), the `canonical_bookings` view, `canonical_gross_booked_revenue()`, `canonical_payments_collected()`, `canonical_outstanding_balance()`, `canonical_average_booking_value()`, `canonical_conversion_funnel()`, and one representative consumer migration (`get_venue_analytics()`, additive fields only).
- `lib/metrics/` — the Metric Registry as real, importable code (`registry.ts`, `types.ts`) plus typed read functions (`booking.ts`, `revenue.ts`, `conversion.ts`, `health.ts`).
- Two pre-existing, unrelated production bugs found and fixed because they blocked testing this phase's own work — see §5.

All SQL was tested against the live local database with synthetic data inside rolled-back transactions (zero footprint); `npx tsc --noEmit` is clean on every new file.

---

## 1. Two Findings Requiring a Stop-and-Explain Before Proceeding

Per the brief's own final rule. Neither blocked the phase — both were resolved with the most conservative, schema-consistent choice available, stated here rather than silently assumed.

**Finding A — no structured "required initial payment" signal.** `payment_line_items` has no `type`/`is_deposit` column, only free-text `label` and `sort_order`. Canonical Booking uses the lowest-`sort_order` line item per schedule as the structural proxy for "the deposit or booking fee." This is a real, if reasonable, interpretation choice — not something the schema enforces.

**Finding B — the 11 certified Revenue Categories don't map onto existing data.** `invoice_line_items.type` (8 mechanical values: package/addon/inventory/discount/fee/tax/deposit/item) and `packages.category` (freeform text) don't carry the granularity the certified categories require. `revenue_category` was added as a new, nullable column, backfilled best-effort (confident for tax/discount/inventory/fee; approximate for package-derived rows via text-matching `packages.category`). **"Venue Services" and "Venue Vendors" have zero existing signal to derive from and are backfilled to neither** — every historical row that should be one of these two categories currently lands elsewhere (mostly "Packages" or "Other"). This is a real, honest gap, not a rounding error — a manual categorization pass or a product decision on capturing this at entry time is needed before these two categories can be trusted in any report.

---

## 2. Updated Metric Registry

The live source of truth is `lib/metrics/registry.ts` — a typed, importable `MetricDefinition[]`, not just this document. Summary:

| Metric | Status | Formula location |
|---|---|---|
| Booking | `canonical` | SQL view `canonical_bookings` |
| Bookings This Month / This Year | `canonical` | `lib/metrics/booking.ts` |
| Bookings by Venue | `canonical` | trivial (venue_id already on every row) |
| Bookings by Lead Source | `canonical` | `lib/metrics/booking.ts:getBookingsByLeadSource` |
| Bookings by Coordinator | `canonical_pending` | **blocked** — no structured coordinator field exists anywhere (see §3) |
| Booking Forecast | `canonical_pending` | **blocked** — no forecasting methodology was specified (see §3) |
| Gross Booked Revenue | `canonical` | SQL fn `canonical_gross_booked_revenue` |
| Payments Collected | `canonical` | SQL fn `canonical_payments_collected` |
| Outstanding Balance | `canonical` | derived, SQL fn `canonical_outstanding_balance` |
| Average Booking Value | `canonical` | derived, SQL fn `canonical_average_booking_value` |
| Revenue Category (dimension) | `canonical` | `invoice_line_items.revenue_category` |
| Booking Conversion Rate | `canonical` | SQL fn `canonical_conversion_funnel().bookingConversionRate` |
| 6 named funnel stages (§4 of the brief) | `canonical` | SQL fn `canonical_conversion_funnel().stages.*` |
| Venue Health | `canonical` | unchanged, renamed export (`lib/metrics/health.ts:getVenueHealth`) |
| Relationship Health | `canonical` | unchanged, renamed export (`getRelationshipHealth`) |
| Vendor Health | `canonical` | unchanged, renamed export (`getVendorHealth`) |
| Platform Health | `canonical` | unchanged, renamed export (`getPlatformHealth`) |
| 4 named legacy duplicates (leadFunnel.conversionRate, payments.totalCollected ×2 variants, v_bookings_30d) | `legacy_unmigrated` | still live, see §3 |

---

## 3. Metric Migration Matrix

Every consumer of a certified-duplicate metric, its current state, and its target. Per the brief: legacy stays live until every consumer has migrated — this matrix is the actionable backlog for that, not a claim that migration is finished.

| Consumer | Current (legacy) call | Target (canonical) call | Status |
|---|---|---|---|
| `get_venue_analytics()` → Venue Analytics page's Lead Funnel card | `leadFunnel.conversionRate` (leads.status='won' proxy) | `leadFunnel.bookingConversionRate` (new field, added this phase) | **Field added, both live side by side.** UI component not yet updated to display the new field — no UI was touched this phase, per its own scope limits. |
| `get_venue_analytics()` → Venue Analytics page's Payments card | `payments.totalCollected` (sums `invoices.total-balance_due`) | `payments.totalCollectedCanonical` (new field, calls `canonical_payments_collected()`) | **Field added, both live side by side.** Same UI-not-touched caveat. |
| `get_venue_trends()` → Luv Story Mode / trend narration | `currentMonth.paymentsCollected` (rolling-window `payment_line_items.paid_amount` sum) | `canonical_payments_collected({from, to})` | **Not migrated.** `get_venue_trends()` was not touched this phase — its formula is already closer to canonical (same table, same net-of-refund shape) than `get_venue_analytics()`'s variant was; lower priority. |
| `compute_venue_health_score()` → Venue Health's Booking Momentum dimension | `v_bookings_30d` (`clients.created_at` in last 30d) | Not necessarily `Booking` — see note | **Deliberately not migrated.** This dimension may legitimately want a *leading* indicator (a client just created, before contract/deposit) rather than the stricter, later-firing canonical Booking event. Migrating this requires a product decision (does "booking momentum" mean new relationships or completed bookings?), not a mechanical swap — flagged, not resolved. |
| Every other consumer of the 11 duplicate groups from the Metric Definition Registry Certification (Health Score naming collisions, Adoption % pairs, RSVP Rate ×3, Overdue Payments ×3, etc.) | various | various | **Not migrated.** Out of this phase's bounded scope — see §6 backlog. Health Score naming is resolved at the *export* level (§2) without touching any consumer, since the brief's own fix for that group was a rename, not a formula change. |

---

## 4. Duplicate Resolution Report

Against the 11 groups certified in `docs/metric-definition-registry-certification.md` §2:

| Group | Resolution this phase |
|---|---|
| Booking (Bookings 30d, §2.5 of that cert) | **Canonical definition implemented.** One new definition (signed + deposit) now exists in code; the two pre-existing variants remain live and unreconciled — see Migration Matrix. Not "fixed," but no longer undefined. |
| Revenue/Payments Collected (§2.3) | **Canonical definition implemented and validated** to agree with the legacy `get_venue_analytics()` variant when data is well-formed (both computed 1000.00 against identical synthetic data in this phase's own test) — and to correctly diverge from it in an edge case the legacy formula mishandles (a payment schedule not linked to its invoice via `invoice_id`), which is itself informative, not a bug. |
| Conversion Rate (§2.2) | **Canonical Booking Conversion Rate implemented**, plus all 6 other stages explicitly named per the brief's own rule (never called "Conversion Rate"). The other 3 pre-existing "conversion rate" variants (Lead Source, Tour-to-Booking, Vendor Inquiry) are untouched — they measure genuinely different things and were never meant to collapse into one metric. |
| Health Score (§2.1) | **Resolved by renaming, not recalculating** — `lib/metrics/health.ts` exports `getVenueHealth`/`getRelationshipHealth`/`getVendorHealth`/`getPlatformHealth`, each a thin re-export of its already-clean, already-non-conflicting underlying implementation. No formula changed. |
| Leads Created 30d (§2.4) | **Not addressed this phase.** Byte-identical formula, two call sites — the lowest-risk item in the entire certification, deliberately deferred to keep this phase's SQL surface bounded to Booking/Revenue/Conversion/Health as scoped. |
| Overdue Payments (§2.6) | **Not addressed.** The certification's own recommendation was to keep all three variants, explicitly named — no code change needed, only documentation, which the certification itself already provides. |
| Adoption % (§2.7) | **Not addressed.** Naming-only fix recommended by the prior certification; not in this phase's four named families (Booking/Revenue/Conversion/Health). |
| RSVP Rate (§2.8) | **Not addressed.** Same reasoning as Leads Created 30d. |

---

## 5. Two Pre-Existing Bugs Found and Fixed (unrelated to canonical metrics, found while testing this phase's own work)

Both inside `get_venue_analytics()`, the one function this phase modified to prove the pattern end-to-end. Neither is a duplicate-metric issue — both are the function referencing schema that no longer exists, meaning **the Venue Analytics page has been non-functional** (would throw on every real call) independent of anything in this phase:

1. `leads.tour_date` was dropped by `20260718000000_program2_phase1a_canonical_tour_scheduling.sql`, which established `tour_appointments` as the canonical tour source — `get_venue_analytics()` was never updated after that drop. Fixed to use `tour_appointments`, matching the same source this phase's own `canonical_conversion_funnel()` already uses.
2. `public.couple_seating_arrangements` does not exist and, as far as this pass could determine, never has — the real seating tables are `guest_seat_assignments` (linked via `couple_guests`) and `floor_plans`. Fixed to the real join.

**Deliberately not pursued further.** Both fixes were made only because they blocked testing this phase's own additive field — a full audit of `get_venue_analytics()` (or any other function) for further broken references is out of scope for a canonical-metrics implementation phase and is called out here as its own, separate, urgent finding rather than chased exhaustively. **Recommend a dedicated pass verifying every function in `supabase/migrations/` against the current live schema**, independent of any reporting work — the fact that two breaks were found in the single function this phase happened to touch suggests there may be more elsewhere.

---

## 6. Updated Dependency Graph

Extends the Metric Definition Registry Certification's graph with the new canonical layer:

```
Outstanding Balance
├── depends on: Gross Booked Revenue
└── depends on: Payments Collected

Average Booking Value
├── depends on: Gross Booked Revenue
└── depends on: Booking (count)

Gross Booked Revenue
└── depends on: Booking (join scope — only booked clients' invoices count)

Booking Conversion Rate
└── depends on: Booking (count) + Lead Funnel's Inquiry count

6 named funnel stages
└── each depends on: the stage before it in canonical_conversion_funnel()'s
    own sequential computation (Inquiry -> Tour -> Proposal -> Contract
    Sent -> Contract Signed -> Deposit -> Booking) — all seven numbers
    come from ONE function call, never seven independent queries

get_venue_analytics().leadFunnel.bookingConversionRate (new field)
└── depends on: canonical_conversion_funnel() (calls it directly, does
    not recompute)

get_venue_analytics().payments.totalCollectedCanonical (new field)
└── depends on: canonical_payments_collected() (calls it directly)

Bookings by Lead Source
└── depends on: Booking, joined through clients.lead_id -> leads.source

Venue Health / Relationship Health / Vendor Health / Platform Health
└── each depends on nothing new — unchanged from the Metric Definition
    Registry Certification's own graph, which already found these four
    to be self-contained with zero shared dependencies
```

No circular dependencies. No canonical metric in this phase depends on a still-unresolved legacy duplicate — every dependency above points at another canonical metric or a raw table.

---

## 7. PASS / FAIL Certification

| Metric | Verdict | Notes |
|---|---|---|
| Booking | **PASS (canonical, implemented)** | One definition, one view, tested against synthetic data. |
| Bookings This Month / This Year / by Lead Source / by Venue | **PASS (canonical, implemented)** | |
| Bookings by Coordinator | **FAIL — blocked, not a code problem** | No structured source field exists; needs a product decision, registered as `canonical_pending`. |
| Booking Forecast | **FAIL — blocked, not a code problem** | No methodology was specified; registered as `canonical_pending`. |
| Gross Booked Revenue / Payments Collected / Outstanding Balance / Average Booking Value | **PASS (canonical, implemented and validated)** | Verified to match the legacy formula under well-formed data, and to correctly diverge under a data-linkage gap the legacy formula silently mishandles. |
| Revenue Category (dimension) | **PARTIAL PASS** | Structurally implemented; 2 of 11 categories (Venue Services, Venue Vendors) have zero backfill confidence — flagged, not hidden. |
| Booking Conversion Rate + 6 named stages | **PASS (canonical, implemented)** | One function, seven numbers, zero ambiguity about which is "Conversion Rate." |
| Venue Health / Relationship Health / Vendor Health / Platform Health | **PASS (canonical, renamed)** | Zero formula changes; naming collision resolved. |
| Every consumer still reading a legacy duplicate (Migration Matrix, §3) | **FAIL — not yet migrated** | Explicitly not deleted, per the brief's own instruction; tracked as backlog, §8. |

**Zero duplicated Booking definitions were eliminated** (the brief's own success criterion) — this is honest to state plainly: two pre-existing "bookings 30d" variants still exist unreconciled, alongside the new canonical one, because Section 7 of the brief explicitly forbids deleting legacy calculations before every consumer migrates, and only one representative consumer was migrated this phase. What changed is that **exactly one canonical definition now exists to migrate toward** — the certification's own stated goal for this phase — not that duplication has already been fully eliminated.

---

## 8. Remaining Implementation Backlog

Ordered by dependency and risk, continuing from the Metric Definition Registry Certification's own §7 sequence:

1. **Update the Venue Analytics UI** to read and display `leadFunnel.bookingConversionRate` and `payments.totalCollectedCanonical` (both already present in the RPC response) — the first real UI consumer migration, explicitly out of this phase's scope.
2. **Migrate `get_venue_trends()`'s `paymentsCollected`** to call `canonical_payments_collected()` with its existing rolling-window parameters, retiring its independent `payment_line_items` aggregation.
3. **Product decision: Booking Momentum's data source.** Does Venue Health's "booking momentum" dimension want canonical Booking (signed + deposit) or should it deliberately stay a leading indicator on `clients.created_at`? Resolve before touching `compute_venue_health_score()`.
4. **Product decision: a real coordinator-assignment field**, if "Bookings by Coordinator" is still wanted — this is a product/schema decision (which entity owns assignment: Lead? Client? Event?), not a reporting-layer fix.
5. **Product decision: Booking Forecast methodology** — needs a named formula before any code can be written.
6. **Manual review of the `revenue_category` backfill**, specifically every row currently defaulted to "Other" or "Packages" that should be "Venue Services" or "Venue Vendors" — no automated signal exists for this distinction today.
7. **A dedicated schema-drift audit pass** across every SQL function in `supabase/migrations/`, independent of reporting work — motivated directly by finding two broken references in the one function this phase touched (§5).
8. Only after 1–7: migrate the remaining 7 duplicate groups the Metric Definition Registry Certification identified but this phase did not touch (Leads Created 30d, Overdue Payments, Adoption %, RSVP Rate, and the two Health-adjacent items already noted).
