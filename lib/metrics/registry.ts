/**
 * Reporting & Analytics — Canonical Metric Implementation.
 *
 * THE Metric Registry (§6 of the brief) — the live, importable source of
 * truth for every canonical metric's definition. Exactly one row per
 * canonical metric, per the brief's own rule. Legacy entries (still-live
 * duplicate calculations this phase has not yet migrated every consumer
 * off of) are included too, each pointing at its canonical replacement in
 * `businessDefinition`, so nothing that still exists in the codebase is
 * invisible to this registry — see docs/metric-registry-canonical-
 * implementation.md's Migration Matrix for the full consumer-by-consumer
 * status.
 */

import type { MetricDefinition } from "@/lib/metrics/types";

export const METRIC_REGISTRY: MetricDefinition[] = [
  // ── Booking ─────────────────────────────────────────────────────────────
  {
    name: "Booking",
    businessDefinition:
      "A Booking occurs only when BOTH are true: a Contract has been fully executed (signed), AND the required initial payment (deposit or booking fee) has been successfully collected.",
    owner: "Client",
    formula:
      "EXISTS(contract WHERE client_id=c.id AND status='signed') AND EXISTS(payment_schedule WHERE client_id=c.id AND its lowest-sort_order payment_line_item has status='paid'). booked_at = GREATEST(contract.signed_at, deposit_line_item.paid_at).",
    sourceTables: ["clients", "contracts", "payment_schedules", "payment_line_items"],
    dimensions: ["Venue (implicit)", "Lead Source"],
    filters: ["date range (booked_at)"],
    aggregationRules: "One row per Client meeting both conditions — canonical_bookings view, not a count function.",
    unit: "boolean / row existence",
    precision: "n/a",
    consumers: ["lib/metrics/booking.ts", "lib/metrics/revenue.ts", "lib/metrics/conversion.ts"],
    dependencies: [],
    status: "canonical",
  },
  {
    name: "Bookings This Month",
    businessDefinition: "Canonical Bookings whose booked_at falls in the current calendar month.",
    owner: "Venue", formula: "COUNT(canonical_bookings WHERE booked_at >= start_of_month)",
    sourceTables: ["canonical_bookings"], dimensions: [], filters: [],
    aggregationRules: "COUNT", unit: "count", precision: "integer",
    consumers: ["lib/metrics/booking.ts:getBookingsThisMonth"], dependencies: ["Booking"], status: "canonical",
  },
  {
    name: "Bookings This Year",
    businessDefinition: "Canonical Bookings whose booked_at falls in the current calendar year.",
    owner: "Venue", formula: "COUNT(canonical_bookings WHERE booked_at >= start_of_year)",
    sourceTables: ["canonical_bookings"], dimensions: [], filters: [],
    aggregationRules: "COUNT", unit: "count", precision: "integer",
    consumers: ["lib/metrics/booking.ts:getBookingsThisYear"], dependencies: ["Booking"], status: "canonical",
  },
  {
    name: "Bookings by Venue",
    businessDefinition: "Canonical Bookings grouped by owning venue.",
    owner: "Venue", formula: "GROUP BY canonical_bookings.venue_id",
    sourceTables: ["canonical_bookings"], dimensions: ["Venue"], filters: ["date range"],
    aggregationRules: "COUNT ... GROUP BY venue_id — trivial, every canonical_bookings row already carries venue_id.",
    unit: "count", precision: "integer",
    consumers: ["Not yet built as a dedicated export — trivial given canonical_bookings.venue_id"],
    dependencies: ["Booking"], status: "canonical",
  },
  {
    name: "Bookings by Lead Source",
    businessDefinition: "Canonical Bookings grouped by the originating Lead's source.",
    owner: "Venue", formula: "GROUP BY leads.source, joined via clients.lead_id",
    sourceTables: ["canonical_bookings", "clients", "leads"], dimensions: ["Lead Source"], filters: ["date range"],
    aggregationRules: "COUNT ... GROUP BY leads.source",
    unit: "count", precision: "integer",
    consumers: ["lib/metrics/booking.ts:getBookingsByLeadSource"], dependencies: ["Booking"], status: "canonical",
  },
  {
    name: "Bookings by Coordinator",
    businessDefinition: "Canonical Bookings grouped by the responsible staff member.",
    owner: "Venue", formula: "NOT IMPLEMENTABLE with current schema — see blockedReason.",
    sourceTables: [], dimensions: ["Coordinator"], filters: [],
    aggregationRules: "n/a", unit: "count", precision: "n/a",
    consumers: [], dependencies: ["Booking"], status: "canonical_pending",
    blockedReason:
      "No structured field associates a Client/Lead/Event with a responsible staff member. tour_appointments.assigned_to is free text with no FK to venue_staff — not reliable enough for a canonical, one-source-of-truth metric. Requires a product decision (a real coordinator-assignment field) before this can be implemented, not a calculation choice.",
  },
  {
    name: "Booking Forecast",
    businessDefinition: "A projection of future Bookings.",
    owner: "Venue", formula: "NOT SPECIFIED — no formula was given in the certified business definitions.",
    sourceTables: [], dimensions: [], filters: [],
    aggregationRules: "n/a", unit: "n/a", precision: "n/a",
    consumers: [], dependencies: ["Booking"], status: "canonical_pending",
    blockedReason:
      "No forecasting methodology (linear projection, pipeline-weighted, seasonal, etc.) was specified. Implementing one would mean inventing a new metric, which this phase's brief explicitly forbids. Needs a product decision on methodology before implementation.",
  },

  // ── Revenue ─────────────────────────────────────────────────────────────
  {
    name: "Gross Booked Revenue",
    businessDefinition:
      "The total contracted value of booked events. Includes venue rental, packages, inventory, venue-managed services/vendors, F&B, beverage packages, ceremony fees, setup/cleanup fees, and other contracted charges. Excludes taxes, refunds, and outstanding balances.",
    owner: "Venue",
    formula: "SUM(invoices.subtotal - invoices.discount_amount) for invoices belonging to canonical_bookings clients, excluding status='void'.",
    sourceTables: ["invoices", "canonical_bookings"], dimensions: ["Venue (implicit)", "Revenue Category (via invoice_line_items.revenue_category)"],
    filters: ["date range (booked_at)"], aggregationRules: "SUM",
    unit: "$", precision: "numeric(10,2), cents",
    consumers: ["lib/metrics/revenue.ts:getGrossBookedRevenue", "Average Booking Value", "Outstanding Balance"],
    dependencies: ["Booking"], status: "canonical",
  },
  {
    name: "Payments Collected",
    businessDefinition: "Money successfully received. Not invoiced. Not contracted. Actually paid.",
    owner: "Venue",
    formula: "SUM(COALESCE(paid_amount, amount) - COALESCE(refunded_amount, 0)) WHERE status IN ('paid','partially_refunded','refunded'), venue-scoped.",
    sourceTables: ["payment_line_items"], dimensions: ["Venue (implicit)"], filters: ["date range (paid_at)"],
    aggregationRules: "SUM, net of refunds — reuses lib/payments/repository.ts's own reconciliation formula rather than reimplementing it.",
    unit: "$", precision: "numeric(12,2), cents",
    consumers: ["lib/metrics/revenue.ts:getPaymentsCollected", "Outstanding Balance"],
    dependencies: [], status: "canonical",
  },
  {
    name: "Outstanding Balance",
    businessDefinition: "Gross Booked Revenue minus Payments Collected.",
    owner: "Venue", formula: "canonical_gross_booked_revenue() - canonical_payments_collected()",
    sourceTables: [], dimensions: ["Venue (implicit)"], filters: ["date range"],
    aggregationRules: "Derived — never independently summed.",
    unit: "$", precision: "numeric",
    consumers: ["lib/metrics/revenue.ts:getOutstandingBalance"],
    dependencies: ["Gross Booked Revenue", "Payments Collected"], status: "canonical",
  },
  {
    name: "Average Booking Value",
    businessDefinition: "Gross Booked Revenue divided by Bookings.",
    owner: "Venue", formula: "canonical_gross_booked_revenue() / COUNT(canonical_bookings)",
    sourceTables: ["canonical_bookings"], dimensions: ["Venue (implicit)"], filters: ["date range"],
    aggregationRules: "Derived ratio.",
    unit: "$", precision: "numeric",
    consumers: ["lib/metrics/revenue.ts:getAverageBookingValue"],
    dependencies: ["Gross Booked Revenue", "Booking"], status: "canonical",
  },
  {
    name: "Revenue Category (dimension)",
    businessDefinition:
      "Every financial line item belongs to exactly one of 11 categories (Venue Rental, Packages, Inventory, Food & Beverage, Alcohol, Venue Services, Venue Vendors, Service Charges, Discounts, Taxes, Other). A reporting dimension, not a separate revenue definition.",
    owner: "Invoice Line Item",
    formula: "invoice_line_items.revenue_category (new column). Backfilled best-effort from existing type/packages.category — see the migration's own comment for exactly which mappings are confident vs. approximate. 'Venue Services' and 'Venue Vendors' have no existing signal and are backfilled to neither.",
    sourceTables: ["invoice_line_items", "packages"], dimensions: ["Revenue Category"], filters: [],
    aggregationRules: "n/a (a dimension, not an aggregate itself)",
    unit: "enum (11 values)", precision: "n/a",
    consumers: ["lib/metrics/revenue.ts:getGrossBookedRevenueByCategory"],
    dependencies: [], status: "canonical",
  },

  // ── Conversion ──────────────────────────────────────────────────────────
  {
    name: "Booking Conversion Rate",
    businessDefinition: "Inquiry -> Booking. The only metric permitted to be named \"Conversion Rate.\"",
    owner: "Venue", formula: "ROUND(100.0 * COUNT(booked) / COUNT(inquiry, status<>'cancelled'))",
    sourceTables: ["leads", "canonical_bookings"], dimensions: ["Venue (implicit)"], filters: [],
    aggregationRules: "Computed inside canonical_conversion_funnel() alongside every other stage, from the same underlying counts.",
    unit: "%", precision: "integer (rounded)",
    consumers: ["lib/metrics/conversion.ts:getBookingConversionRate"],
    dependencies: ["Booking"], status: "canonical",
  },
  ...([
    ["Inquiry → Tour Scheduled", "inquiryToTourScheduled", "leads (via tour_appointments)"],
    ["Tour → Proposal", "tourToProposal", "leads"],
    ["Proposal → Contract Sent", "proposalToContractSent", "leads, clients, contracts (sent_at)"],
    ["Contract Sent → Contract Signed", "contractSentToSigned", "contracts (sent_at, signed_at)"],
    ["Contract Signed → Deposit Received", "contractSignedToDeposit", "contracts, payment_schedules, payment_line_items"],
    ["Deposit Received → Booking", "depositToBooking", "payment_line_items, canonical_bookings"],
  ] as const).map(([name, field, tables]) => ({
    name,
    businessDefinition: `Named funnel stage (§4) — never called "Conversion Rate."`,
    owner: "Venue",
    formula: `canonical_conversion_funnel().stages.${field}`,
    sourceTables: tables.split(", "),
    dimensions: ["Venue (implicit)"], filters: [],
    aggregationRules: "Computed inside canonical_conversion_funnel(), one call for all seven stages.",
    unit: "%", precision: "integer (rounded)",
    consumers: [`lib/metrics/conversion.ts`],
    dependencies: [], status: "canonical" as const,
  })),

  // ── Health ──────────────────────────────────────────────────────────────
  {
    name: "Venue Health",
    businessDefinition: "Measures venue adoption and operational health.",
    owner: "Venue",
    formula: "compute_venue_health_score() — 4 dimensions (Lead Flow, Pipeline Activity, Booking Momentum, Task Health), equal 25% weight, tiered thriving/growing/needs_attention.",
    sourceTables: ["leads", "clients", "lead_tasks", "venue_health_scores"], dimensions: ["Venue"], filters: [],
    aggregationRules: "Weighted composite, materialized with a 24h DB-side cache.",
    unit: "0-100", precision: "integer",
    consumers: ["lib/metrics/health.ts:getVenueHealth"], dependencies: [], status: "canonical",
  },
  {
    name: "Relationship Health",
    businessDefinition: "Measures the health of a client/event relationship.",
    owner: "Event",
    formula: "get_client_health_scores() — 13 weighted signals (portal, guests, payments, tasks, feedback, referrals), tiered at_risk/needs_attention/healthy/champion.",
    sourceTables: ["events", "clients", "client_portal_sessions", "couple_guests", "payment_line_items", "event_tasks", "couple_venue_feedback", "couple_referrals"],
    dimensions: ["Event"], filters: [],
    aggregationRules: "Weighted composite, computed live per call (not materialized).",
    unit: "0-100", precision: "integer",
    consumers: ["lib/metrics/health.ts:getRelationshipHealth"], dependencies: [], status: "canonical",
  },
  {
    name: "Vendor Health",
    businessDefinition: "Measures vendor engagement and performance.",
    owner: "Vendor",
    formula: "computeVendorHealthScore() — 5 dimensions (Profile, Packages, Insurance, Availability, Marketplace, Momentum), unequal weights, tiered thriving/growing/needs_attention.",
    sourceTables: ["vendors", "vendor_packages", "vendor_availability", "vendor_inquiries", "vendor_health_scores"],
    dimensions: ["Vendor"], filters: [],
    aggregationRules: "Weighted composite, app-layer 1h TTL, backed by vendor_health_scores.",
    unit: "0-100", precision: "integer",
    consumers: ["lib/metrics/health.ts:getVendorHealth"], dependencies: [], status: "canonical",
  },
  {
    name: "Platform Health",
    businessDefinition: "Internal Hello to Cheers operational metric.",
    owner: "Platform (HQ)",
    formula: "computeHealthStatus() per venue (critical/at_risk/healthy — inactivity-days + Activation Score thresholds), rolled up via getBetaOverview().",
    sourceTables: ["venue_activation_scores", "engagement_events"], dimensions: ["Venue (per row)", "Platform (rollup)"], filters: [],
    aggregationRules: "Categorical per-venue status, cohort rollup via reduction over already-loaded rows (adds zero new SQL).",
    unit: "enum (critical/at_risk/healthy)", precision: "n/a",
    consumers: ["lib/metrics/health.ts:getPlatformHealth"], dependencies: [], status: "canonical",
  },

  // ── Legacy — not yet migrated (see Migration Matrix) ──────────────────────
  {
    name: "leadFunnel.conversionRate (legacy)",
    businessDefinition: "Superseded by Booking Conversion Rate. Uses leads.status='won' as a booking proxy, not the canonical Booking definition.",
    owner: "Venue", formula: "won / (total not lost) * 100",
    sourceTables: ["leads"], dimensions: [], filters: [],
    aggregationRules: "SUM/COUNT ratio", unit: "%", precision: "integer",
    consumers: ["get_venue_analytics() — Venue Analytics page (unmigrated)"],
    dependencies: [], status: "legacy_unmigrated",
  },
  {
    name: "payments.totalCollected (legacy, variant A)",
    businessDefinition: "Superseded by Payments Collected. Sums invoices.total - balance_due, all-time, not scoped to canonical Bookings.",
    owner: "Venue", formula: "sum(invoices.total - balance_due)",
    sourceTables: ["invoices"], dimensions: [], filters: [],
    aggregationRules: "SUM", unit: "$", precision: "numeric(10,2)",
    consumers: ["get_venue_analytics() — Venue Analytics page (unmigrated)"],
    dependencies: [], status: "legacy_unmigrated",
  },
  {
    name: "currentMonth.paymentsCollected (legacy, variant B)",
    businessDefinition: "Superseded by Payments Collected. Same table/net-of-refund logic as the canonical version, but a fixed rolling-30d window rather than a caller-supplied one.",
    owner: "Venue", formula: "sum(payment_line_items.paid_amount) where status='paid', rolling 30d",
    sourceTables: ["payment_line_items"], dimensions: [], filters: [],
    aggregationRules: "SUM", unit: "$", precision: "numeric(12,2)",
    consumers: ["get_venue_trends() — Luv Story Mode (unmigrated)"],
    dependencies: [], status: "legacy_unmigrated",
  },
  {
    name: "v_bookings_30d (legacy, variant B)",
    businessDefinition: "Superseded by Bookings This Month / Booking. Counts clients.created_at in the last 30 days — not the canonical signed+deposit definition.",
    owner: "Venue", formula: "count(clients) where created_at >= now()-30d",
    sourceTables: ["clients"], dimensions: [], filters: [],
    aggregationRules: "COUNT", unit: "count", precision: "integer",
    consumers: ["compute_venue_health_score() — Venue Health's Booking Momentum dimension (unmigrated; may legitimately stay a leading indicator distinct from canonical Booking — see the Migration Matrix's note on this item)"],
    dependencies: [], status: "legacy_unmigrated",
  },
];

/** Quick lookup by canonical name. */
export function getMetricDefinition(name: string): MetricDefinition | undefined {
  return METRIC_REGISTRY.find((m) => m.name === name);
}
