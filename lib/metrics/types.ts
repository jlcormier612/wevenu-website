/**
 * Reporting & Analytics — Canonical Metric Implementation.
 *
 * The Metric Registry's own type. Every canonical metric in
 * `lib/metrics/registry.ts` is one of these — this is the structured,
 * importable shape "Update the Metric Registry" (§6 of the brief) actually
 * means, superseding the certification markdown as the live source of
 * truth for these fields (the markdown documents this file; this file is
 * not documentation of the markdown).
 */

export type MetricStatus =
  | "canonical"          // one implementation, this is it
  | "canonical_pending"  // definition certified, formula not yet implementable (see notes)
  | "legacy_unmigrated";  // an old, still-live duplicate this registry does not yet supersede for every consumer

export type MetricDefinition = {
  name: string;
  businessDefinition: string;
  owner: string;
  formula: string;
  sourceTables: string[];
  dimensions: string[];
  filters: string[];
  aggregationRules: string;
  unit: string;
  precision: string;
  consumers: string[];
  dependencies: string[];
  status: MetricStatus;
  /** Present only for `canonical_pending` — why it isn't implemented yet. */
  blockedReason?: string;
};
