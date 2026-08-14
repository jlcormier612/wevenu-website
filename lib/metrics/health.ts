/**
 * Reporting & Analytics — Canonical Metric Implementation.
 *
 * Canonical Health metrics (§5 of the brief). The single metric named
 * "Health Score" no longer exists — four distinct, non-colliding names
 * replace it. Per the Metric Definition Registry Certification, all four
 * underlying formulas were already clean, self-contained, non-conflicting
 * implementations — the only real problem was the shared name. This file
 * is therefore a canonical NAMING layer, not a recalculation: every export
 * below re-exports an existing, unmodified function under its new name.
 * None of the four underlying SQL functions or scoring modules were
 * changed by this phase.
 */

export { getVenueHealthScore as getVenueHealth } from "@/lib/luv/health-service";
export { getClientHealthScores as getRelationshipHealth } from "@/lib/analytics/service";
export { getVendorHealthScore as getVendorHealth } from "@/lib/vendor-health/service";

/**
 * Platform Health — "internal Hello to Cheers operational metric" (§5).
 * Re-exports the existing Beta Command Center overview, whose per-venue
 * `healthStatus` (critical/at_risk/healthy, lib/hq/beta-scoring.ts) is
 * exactly the internal, HQ-only operational view the brief describes —
 * distinct in formula, scale, and audience from the other three.
 */
export { getBetaOverview as getPlatformHealth } from "@/lib/hq/beta-service";
