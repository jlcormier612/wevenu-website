import { redirect } from "next/navigation";

/**
 * Work Package R2 — legacy Analytics retirement (brief §49/§51).
 *
 * Every capability this page had is now accounted for in /reporting:
 *   - Lead Funnel (leads.status='won' proxy) + by-source     → superseded by
 *     the canonical Sales report (real Booking definition, not a proxy).
 *   - Events upcoming/this-month/next-month/12mo trend       → superseded by
 *     the Events report's own date-range-filterable trend.
 *   - Events avg guest count                                  → migrated to
 *     the Events report.
 *   - Payments totalCollected/totalBilled/completionRate/
 *     totalOutstanding (all non-canonical, duplicate formulas
 *     per lib/metrics/registry.ts's own "legacy_unmigrated"
 *     entries)                                                 → superseded
 *     by the Revenue report's canonical Payments Collected / Outstanding
 *     Balance.
 *   - Payments overdue count/amount                            → migrated
 *     into the Revenue report's Outstanding Balance detail (per-client
 *     "Overdue" flag).
 *   - Client Health (canonical Relationship Health)            → migrated,
 *     compact form, into the Bookings report's "Clients Needing Attention."
 *   - Client Engagement (portal adoption / RSVP completion) and
 *     Feature Adoption (8 platform-usage rates)                → deliberately
 *     deferred, not migrated — no canonical Metric Registry definition
 *     exists for either, and they answer a product-adoption question, not
 *     a Sales/Bookings/Revenue/Events business question. Documented as a
 *     Canonical Metric Gap in docs/reporting-depth-and-consolidation-
 *     implementation.md rather than silently dropped or force-fit into an
 *     IA category that doesn't fit them.
 *   - Luv Roll-Up                                               → explicitly
 *     out of Reporting's scope (brief §55); Luv's own surfaces are
 *     unaffected by this retirement.
 *
 * A plain redirect, not a deletion — existing bookmarks/links still land
 * somewhere real (brief §51).
 */
export default function AnalyticsPage() {
  redirect("/reporting");
}
