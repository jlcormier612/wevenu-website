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
  // ── Lifecycle Booking ───────────────────────────────────────────────────
  {
    name: "Lifecycle Booking",
    businessDefinition:
      "A Lifecycle Booking is the venue's explicit booking decision, recorded as a durable first_booked event in lifecycle_booking_events (origins: pipeline via Book This Lead, direct via Direct Add, import via Migration Center Mark as already booked). first_booked_at / occurred_at is write-once; rebooked events do not overwrite it. Distinct from Financially Committed and from events.booked_at (payment timing).",
    owner: "Lead or Client",
    formula:
      "COUNT(lifecycle_booking_events WHERE event_kind='first_booked' AND occurred_at in window). Origins preserved. Currently Booked pipeline snapshot = COUNT(leads WHERE sales_stage='booked') — separate metric.",
    sourceTables: ["lifecycle_booking_events", "leads", "clients"],
    dimensions: ["Venue (implicit)", "Origin", "Lead Source (when lead_id present)"],
    filters: ["date range (occurred_at)"],
    aggregationRules: "One first_booked row per lead (pipeline) or leadless client (direct/import).",
    unit: "count / row existence",
    precision: "n/a",
    consumers: ["lib/metrics/lifecycle-booking.ts", "app/(app)/reporting/*"],
    dependencies: [],
    status: "canonical",
  },
  {
    name: "Bookings This Month",
    businessDefinition: "Lifecycle first_booked events whose occurred_at falls in the current calendar month.",
    owner: "Venue", formula: "COUNT(lifecycle_booking_events WHERE event_kind='first_booked' AND occurred_at >= start_of_month)",
    sourceTables: ["lifecycle_booking_events"], dimensions: [], filters: [],
    aggregationRules: "COUNT", unit: "count", precision: "integer",
    consumers: ["lib/metrics/lifecycle-booking.ts"], dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  {
    name: "Bookings This Year",
    businessDefinition: "Lifecycle first_booked events whose occurred_at falls in the current calendar year.",
    owner: "Venue", formula: "COUNT(lifecycle_booking_events WHERE event_kind='first_booked' AND occurred_at >= start_of_year)",
    sourceTables: ["lifecycle_booking_events"], dimensions: [], filters: [],
    aggregationRules: "COUNT", unit: "count", precision: "integer",
    consumers: ["lib/metrics/lifecycle-booking.ts"], dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  {
    name: "Bookings by Venue",
    businessDefinition: "Lifecycle Bookings grouped by owning venue.",
    owner: "Venue", formula: "GROUP BY lifecycle_booking_events.venue_id",
    sourceTables: ["lifecycle_booking_events"], dimensions: ["Venue"], filters: ["date range"],
    aggregationRules: "COUNT ... GROUP BY venue_id",
    unit: "count", precision: "integer",
    consumers: ["Trivial given venue_id"],
    dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  {
    name: "Bookings by Lead Source",
    businessDefinition:
      "Lifecycle first_booked events grouped by frozen acquisition_source (stamped on lifecycle_booking_events / leads.acquisition_source at entry). Operational leads.source edits do not rewrite history. tour_scheduling rolls up to Website for display only. Direct/import without a lead → Unknown/Unattributed — never fabricated.",
    owner: "Venue",
    formula: "GROUP BY reportingSourceGroupKey(lifecycle_booking_events.acquisition_source)",
    sourceTables: ["lifecycle_booking_events", "leads"], dimensions: ["Acquisition Source"], filters: ["date range"],
    aggregationRules: "COUNT ... GROUP BY reporting key; null/other → unknown; website+tour_scheduling → website",
    unit: "count", precision: "integer",
    consumers: ["lib/metrics/attribution.ts", "lib/metrics/lifecycle-booking.ts", "Sales / Bookings"],
    dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  {
    name: "Lead Source Coverage",
    businessDefinition:
      "Share of leads created in the window whose frozen acquisition_source is a known (non-empty, not other) vocabulary key. Denominator includes Unknown.",
    owner: "Venue",
    formula: "ROUND(100 * known / COUNT(leads created in window))",
    sourceTables: ["leads"], dimensions: [], filters: ["lead created_at window"],
    aggregationRules: "known = acquisition_source not null and not other",
    unit: "%", precision: "integer",
    consumers: ["lib/metrics/attribution.ts", "Sales report"], dependencies: [], status: "canonical",
  },
  {
    name: "Lifecycle Booking Source Coverage",
    businessDefinition:
      "Share of lifecycle first_booked events in the window with a known frozen acquisition_source. Denominator includes Unknown (leadless direct/import).",
    owner: "Venue",
    formula: "ROUND(100 * known / COUNT(first_booked in window))",
    sourceTables: ["lifecycle_booking_events"], dimensions: [], filters: ["occurred_at window"],
    aggregationRules: "Uses stamped acquisition_source; never invents",
    unit: "%", precision: "integer",
    consumers: ["lib/metrics/attribution.ts", "Sales / Bookings"], dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  {
    name: "Tours by Acquisition Source",
    businessDefinition:
      "Tour appointments in the window (scheduled_at), attributed via lead.acquisition_source. No lead or missing source → Unknown.",
    owner: "Venue", formula: "GROUP BY reportingSourceGroupKey(leads.acquisition_source) via tour_appointments.lead_id",
    sourceTables: ["tour_appointments", "leads"], dimensions: ["Acquisition Source"], filters: ["scheduled_at"],
    aggregationRules: "Never infer from appointment fields alone",
    unit: "count", precision: "integer",
    consumers: ["lib/metrics/attribution.ts", "Sales report"], dependencies: [], status: "canonical",
  },
  {
    name: "Time to Book (Lead → Lifecycle Booking)",
    businessDefinition:
      "Median whole days from lead.created_at to lifecycle first_booked occurred_at for lead-linked first bookings in the window. Not tour→book or contract→book.",
    owner: "Venue", formula: "median(occurred_at - leads.created_at) for lead-linked first_booked",
    sourceTables: ["lifecycle_booking_events", "leads"], dimensions: [], filters: ["occurred_at window"],
    aggregationRules: "Exclude incalculable rows; leadless excluded",
    unit: "days", precision: "number",
    consumers: ["lib/metrics/attribution.ts", "Sales / Bookings"], dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  {
    name: "Gross Booked Revenue by Acquisition Source",
    businessDefinition:
      "Gross Booked Revenue (Financially Committed, booked_at window) attributed via invoice→event?→client→lead.acquisition_source. Multi-event clients with one originating lead remain attributed. Leadless or missing acquisition_source → Unknown. Not lifecycle Booking revenue.",
    owner: "Venue", formula: "SUM(invoice subtotal-discount) GROUP BY frozen acquisition or unknown",
    sourceTables: ["canonical_bookings", "invoices", "events", "clients", "leads"],
    dimensions: ["Acquisition Source"], filters: ["canonical_bookings.booked_at"],
    aggregationRules: "Event-linked when invoice.event_id set; else client→lead. Never mutable leads.source.",
    unit: "$", precision: "numeric",
    consumers: ["lib/metrics/attribution.ts", "Revenue report"], dependencies: ["Financially Committed", "Gross Booked Revenue"], status: "canonical",
  },
  {
    name: "Bookings by Coordinator",
    businessDefinition: "Canonical Bookings grouped by the responsible staff member.",
    owner: "Venue", formula: "NOT IMPLEMENTABLE with current schema — see blockedReason.",
    sourceTables: [], dimensions: ["Coordinator"], filters: [],
    aggregationRules: "n/a", unit: "count", precision: "n/a",
    consumers: [], dependencies: ["Lifecycle Booking"], status: "canonical_pending",
    blockedReason:
      "No structured field associates a Client/Lead/Event with a responsible staff member. tour_appointments.assigned_to is free text with no FK to venue_staff — not reliable enough for a canonical, one-source-of-truth metric. Requires a product decision (a real coordinator-assignment field) before this can be implemented, not a calculation choice.",
  },
  {
    name: "Booking Forecast",
    businessDefinition: "A projection of future Bookings.",
    owner: "Venue", formula: "NOT SPECIFIED — no formula was given in the certified business definitions.",
    sourceTables: [], dimensions: [], filters: [],
    aggregationRules: "n/a", unit: "n/a", precision: "n/a",
    consumers: [], dependencies: ["Lifecycle Booking"], status: "canonical_pending",
    blockedReason:
      "No forecasting methodology (linear projection, pipeline-weighted, seasonal, etc.) was specified. Implementing one would mean inventing a new metric, which this phase's brief explicitly forbids. Needs a product decision on methodology before implementation.",
  },

  // ── Financially Committed ───────────────────────────────────────────────
  {
    name: "Financially Committed",
    businessDefinition:
      "A client with at least one signed contract AND a payment schedule whose lowest-sort_order payment line item has status='paid'. Implemented as canonical_bookings. Not a Lifecycle Booking. Customer-facing name: Financially Committed.",
    owner: "Client",
    formula:
      "EXISTS(contract WHERE client_id=c.id AND status='signed') AND EXISTS(payment_schedule WHERE client_id=c.id AND its lowest-sort_order payment_line_item has status='paid'). committed_at (view booked_at) = GREATEST(contract.signed_at, deposit_line_item.paid_at).",
    sourceTables: ["clients", "contracts", "payment_schedules", "payment_line_items"],
    dimensions: ["Venue (implicit)"],
    filters: ["date range (canonical_bookings.booked_at)"],
    aggregationRules: "One row per Client meeting both conditions — canonical_bookings view.",
    unit: "boolean / row existence",
    precision: "n/a",
    consumers: ["lib/metrics/booking.ts", "lib/metrics/revenue.ts", "Gross Booked Revenue"],
    dependencies: [],
    status: "canonical",
  },
  {
    name: "Booking",
    businessDefinition:
      "LEGACY NAME — superseded by Lifecycle Booking for venue booking counts, and by Financially Committed for the signed-contract + first-scheduled-payment-paid population. Do not use 'Booking' to mean the financial view.",
    owner: "Client",
    formula: "See Lifecycle Booking and Financially Committed.",
    sourceTables: [],
    dimensions: [],
    filters: [],
    aggregationRules: "n/a",
    unit: "n/a",
    precision: "n/a",
    consumers: [],
    dependencies: ["Lifecycle Booking", "Financially Committed"],
    status: "legacy_unmigrated",
  },

  // ── Revenue ─────────────────────────────────────────────────────────────
  {
    name: "Gross Booked Revenue",
    businessDefinition:
      "The total contracted value of Financially Committed clients' invoices. Includes venue rental, packages, inventory, venue-managed services/vendors, F&B, beverage packages, ceremony fees, setup/cleanup fees, and other contracted charges. Excludes taxes, refunds, and outstanding balances. Not implied by Lifecycle Booking alone.",
    owner: "Venue",
    formula: "SUM(invoices.subtotal - invoices.discount_amount) for invoices belonging to canonical_bookings (Financially Committed) clients, excluding status='void'.",
    sourceTables: ["invoices", "canonical_bookings"], dimensions: ["Venue (implicit)", "Revenue Category (via invoice_line_items.revenue_category)"],
    filters: ["date range (canonical_bookings.booked_at)"], aggregationRules: "SUM",
    unit: "$", precision: "numeric(10,2), cents",
    consumers: ["lib/metrics/revenue.ts:getGrossBookedRevenue", "Average Booking Value", "Outstanding Balance"],
    dependencies: ["Financially Committed"], status: "canonical",
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
    businessDefinition: "Gross Booked Revenue (Financially Committed population) minus Payments Collected.",
    owner: "Venue", formula: "canonical_gross_booked_revenue() - canonical_payments_collected()",
    sourceTables: [], dimensions: ["Venue (implicit)"], filters: ["date range"],
    aggregationRules: "Derived — never independently summed.",
    unit: "$", precision: "numeric",
    consumers: ["lib/metrics/revenue.ts:getOutstandingBalance"],
    dependencies: ["Gross Booked Revenue", "Payments Collected"], status: "canonical",
  },
  {
    name: "Average Booking Value",
    businessDefinition: "Gross Booked Revenue divided by Financially Committed count for the window. Name retained; denominator is not Lifecycle Bookings.",
    owner: "Venue", formula: "canonical_gross_booked_revenue() / COUNT(canonical_bookings)",
    sourceTables: ["canonical_bookings"], dimensions: ["Venue (implicit)"], filters: ["date range"],
    aggregationRules: "Derived ratio over Financially Committed.",
    unit: "$", precision: "numeric",
    consumers: ["lib/metrics/revenue.ts:getAverageBookingValue"],
    dependencies: ["Gross Booked Revenue", "Financially Committed"], status: "canonical",
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

  // ── Business Funnel (Phase 2B) ───────────────────────────────────────────
  {
    name: "Business Funnel — Period Leads",
    businessDefinition:
      "Leads created in the reporting window for the Business Funnel period strip. Excludes status=cancelled and sales_stage=lost. Clock: leads.created_at. Distinct from some legacy lead counts that use different filters.",
    owner: "Venue",
    formula: "COUNT(leads WHERE created_at in window AND status<>'cancelled' AND sales_stage<>'lost')",
    sourceTables: ["leads"],
    dimensions: ["Venue (implicit)"],
    filters: ["created_at window"],
    aggregationRules: "Period snapshot only — never a conversion denominator mixed with period Tours/Bookings.",
    unit: "count",
    precision: "integer",
    consumers: ["lib/metrics/business-funnel.ts", "Overview Business Funnel"],
    dependencies: [],
    status: "canonical",
  },
  {
    name: "Business Funnel — Period Tours",
    businessDefinition:
      "Tour appointments whose scheduled_at falls in the reporting window. Counts appointments, not distinct leads. Not calendar blocks. Clock: tour_appointments.scheduled_at.",
    owner: "Venue",
    formula: "COUNT(tour_appointments WHERE scheduled_at in window)",
    sourceTables: ["tour_appointments"],
    dimensions: ["Venue (implicit)"],
    filters: ["scheduled_at window"],
    aggregationRules: "Period snapshot — NEVER divide into/by period Bookings as conversion.",
    unit: "count",
    precision: "integer",
    consumers: ["lib/metrics/business-funnel.ts", "Overview Business Funnel"],
    dependencies: [],
    status: "canonical",
  },
  {
    name: "Business Funnel — Period Bookings",
    businessDefinition:
      "Lifecycle first_booked events whose occurred_at falls in the window (includes leadless direct/import). Clock: lifecycle_booking_events.occurred_at. Not Financially Committed.",
    owner: "Venue",
    formula: "COUNT via getLifecycleBookings(window)",
    sourceTables: ["lifecycle_booking_events"],
    dimensions: ["Venue (implicit)"],
    filters: ["occurred_at window"],
    aggregationRules: "Period snapshot — distinct from Financially Committed count.",
    unit: "count",
    precision: "integer",
    consumers: ["lib/metrics/business-funnel.ts"],
    dependencies: ["Lifecycle Booking"],
    status: "canonical",
  },
  {
    name: "Business Funnel — Period Financially Committed",
    businessDefinition:
      "Financially Committed clients whose commitment date (canonical_bookings.booked_at) falls in the window. Separate from Lifecycle Booking.",
    owner: "Venue",
    formula: "COUNT via getCanonicalBookings(window)",
    sourceTables: ["canonical_bookings"],
    dimensions: ["Venue (implicit)"],
    filters: ["booked_at window"],
    aggregationRules: "Period snapshot on financial commitment clock.",
    unit: "count",
    precision: "integer",
    consumers: ["lib/metrics/business-funnel.ts"],
    dependencies: ["Financially Committed"],
    status: "canonical",
  },
  {
    name: "Business Funnel — Lead → Tour (cohort)",
    businessDefinition:
      "Of Business Funnel cohort leads (created in window, not cancelled/lost), share that eventually have a tour_appointments row (any time). Not period tours ÷ period leads.",
    owner: "Venue",
    formula: "ROUND(100 * COUNT(cohort leads with any tour_appointments) / COUNT(cohort leads))",
    sourceTables: ["leads", "tour_appointments"],
    dimensions: ["Venue (implicit)"],
    filters: ["lead created_at window"],
    aggregationRules: "Cohort only.",
    unit: "%",
    precision: "integer (rounded)",
    consumers: ["lib/metrics/business-funnel.ts"],
    dependencies: [],
    status: "canonical",
  },
  {
    name: "Business Funnel — Lead → Booking (cohort)",
    businessDefinition:
      "Of Business Funnel cohort leads, share that eventually have leads.first_booked_at (Lifecycle Booking). Same population and rate as customer-facing Booking Conversion Rate / Overview Lead → Booked Rate / Sales Lead → Booked rate (via isBusinessFunnelCohortLead). Not Financially Committed.",
    owner: "Venue",
    formula: "ROUND(100 * COUNT(cohort with first_booked_at) / COUNT(cohort leads))",
    sourceTables: ["leads"],
    dimensions: ["Venue (implicit)"],
    filters: ["lead created_at window; exclude cancelled/lost"],
    aggregationRules: "Cohort only — Lifecycle Booking, not Financially Committed.",
    unit: "%",
    precision: "integer (rounded)",
    consumers: ["lib/metrics/business-funnel.ts", "lib/metrics/lifecycle-booking.ts"],
    dependencies: ["Lifecycle Booking"],
    status: "canonical",
  },
  {
    name: "Business Funnel — Tour → Booking (cohort)",
    businessDefinition:
      "Among Business Funnel cohort leads who eventually toured, share that eventually lifecycle-booked. NEVER period bookings ÷ period tours.",
    owner: "Venue",
    formula: "ROUND(100 * COUNT(toured AND first_booked_at) / COUNT(eventually toured))",
    sourceTables: ["leads", "tour_appointments"],
    dimensions: ["Venue (implicit)"],
    filters: ["lead created_at window"],
    aggregationRules: "Cohort only among eventually-toured leads.",
    unit: "%",
    precision: "integer (rounded)",
    consumers: ["lib/metrics/business-funnel.ts"],
    dependencies: ["Lifecycle Booking"],
    status: "canonical",
  },
  {
    name: "Business Funnel — Outstanding (period strip)",
    businessDefinition:
      "Same as Outstanding Balance: Gross Booked Revenue (commitment booked_at window) minus Payments Collected (paid_at window). Mixed clocks — not a point-in-time balance. Shown in the Business Funnel with an explicit limitation label. No by-source attribution.",
    owner: "Venue",
    formula: "getOutstandingBalance(window) = canonical_gross_booked_revenue - canonical_payments_collected",
    sourceTables: [],
    dimensions: ["Venue (implicit)"],
    filters: ["mixed: booked_at + paid_at"],
    aggregationRules: "Derived; document mixed-clock limitation in UI.",
    unit: "$",
    precision: "numeric",
    consumers: ["lib/metrics/business-funnel.ts", "Overview Business Funnel"],
    dependencies: ["Gross Booked Revenue", "Payments Collected", "Outstanding Balance"],
    status: "canonical",
  },

  // ── Conversion ──────────────────────────────────────────────────────────
  {
    name: "Booking Conversion Rate",
    businessDefinition:
      "Of leads created during a cohort window excluding status=cancelled and sales_stage=lost, the share that eventually received a Lifecycle first_booked (leads.first_booked_at). Same population as Business Funnel Lead → Booking. Not Financially Committed. Not period activity.",
    owner: "Venue", formula: "ROUND(100.0 * COUNT(cohort with first_booked_at) / COUNT(Business Funnel cohort leads))",
    sourceTables: ["leads"], dimensions: ["Venue (implicit)", "Lead Source"], filters: ["lead created_at window; exclude cancelled/lost"],
    aggregationRules: "Cohort only — never mix with financial booked_at. Uses isBusinessFunnelCohortLead.",
    unit: "%", precision: "integer (rounded)",
    consumers: ["lib/metrics/lifecycle-booking.ts:getLeadCohortLifecycleBookingStats", "Overview Lead → Booked Rate", "Sales cohort", "saved-reports export"],
    dependencies: ["Lifecycle Booking"], status: "canonical",
  },
  ...([
    ["Inquiry → Tour Scheduled", "inquiryToTourScheduled", "leads (via tour_appointments)"],
    ["Tour → Proposal", "tourToProposal", "leads"],
    ["Proposal → Contract Sent", "proposalToContractSent", "leads, clients, contracts (sent_at)"],
    ["Contract Sent → Contract Signed", "contractSentToSigned", "contracts (sent_at, signed_at)"],
    ["Contract Signed → Deposit Received", "contractSignedToDeposit", "contracts, payment_schedules, payment_line_items"],
    ["Deposit Received → Financially Committed", "depositToBooking", "payment_line_items, canonical_bookings"],
  ] as const).map(([name, field, tables]) => ({
    name,
    businessDefinition: name.includes("Financially Committed")
      ? "Financial funnel stage of a lead cohort — ends at Financially Committed, not Lifecycle Booking."
      : `Named financial/sales funnel stage — never called "Conversion Rate."`,
    owner: "Venue",
    formula: `canonical_conversion_funnel().stages.${field}`,
    sourceTables: tables.split(", "),
    dimensions: ["Venue (implicit)"], filters: [],
    aggregationRules: "Computed inside canonical_conversion_funnel(), one call for all seven stages. Legacy SQL still names the last stage 'booked' but product language is Financially Committed.",
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
