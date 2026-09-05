/**
 * Phase 2A — Reporting-safe acquisition attribution helpers.
 *
 * Historical attribution uses leads.acquisition_source (write-once at entry)
 * and lifecycle_booking_events.acquisition_source (stamped at first_booked).
 * Operational leads.source may change later and must NOT drive historical reports.
 *
 * Never invent Organic/Direct from blank UTM/referrer.
 * tour_scheduling rolls up to Website for display/grouping only — raw keys stay intact.
 */

import { sourceLabel } from "@/lib/leads/constants";

/** Aggregation key + UI for missing / untrusted attribution. */
export const UNKNOWN_SOURCE_KEY = "unknown";
export const UNKNOWN_SOURCE_LABEL = "Unknown / Unattributed";

/**
 * Known for coverage: non-empty vocabulary key that is not the generic
 * `other` / unknown bucket. Explicit `other` is visible as its own row in
 * some operational UIs but does not count as known attribution coverage.
 */
export function isKnownAcquisitionSource(raw: string | null | undefined): boolean {
  const t = raw?.trim();
  if (!t) return false;
  if (t === "other" || t === UNKNOWN_SOURCE_KEY) return false;
  return true;
}

/**
 * Reporting group key. Merges website + tour_scheduling → website.
 * Null / empty / other → unknown. Does not rewrite stored DB values.
 */
export function reportingSourceGroupKey(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t || t === "other" || t === UNKNOWN_SOURCE_KEY) return UNKNOWN_SOURCE_KEY;
  if (t === "tour_scheduling") return "website";
  return t;
}

/** Customer-facing label for a raw or grouped acquisition source. */
export function reportingSourceDisplayLabel(raw: string | null | undefined): string {
  const key = reportingSourceGroupKey(raw);
  if (key === UNKNOWN_SOURCE_KEY) return UNKNOWN_SOURCE_LABEL;
  if (key === "website") return "Website";
  return sourceLabel(key) || key;
}

export type SourceCoverage = {
  known: number;
  total: number;
  /** Integer percent 0–100; 0 when total is 0. */
  percent: number;
};

export function computeSourceCoverage(sources: Array<string | null | undefined>): SourceCoverage {
  const total = sources.length;
  const known = sources.filter((s) => isKnownAcquisitionSource(s)).length;
  return {
    known,
    total,
    percent: total > 0 ? Math.round((100 * known) / total) : 0,
  };
}

/** Group counts by reporting key (Website rollup, Unknown bucket). */
export function groupCountsByReportingSource(
  rows: Array<{ source: string | null | undefined; weight?: number }>,
): { key: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = reportingSourceGroupKey(row.source);
    map.set(key, (map.get(key) ?? 0) + (row.weight ?? 1));
  }
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: reportingSourceDisplayLabel(key === UNKNOWN_SOURCE_KEY ? null : key),
      count,
    }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_SOURCE_KEY) return 1;
      if (b.key === UNKNOWN_SOURCE_KEY) return -1;
      return b.count - a.count;
    });
}

/** Median of a numeric list; null if empty. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Whole days from lead created → first lifecycle booking.
 * Returns null when either date is missing or ordering is invalid.
 */
export function timeToBookDays(
  leadCreatedAt: string | null | undefined,
  firstBookedAt: string | null | undefined,
): number | null {
  if (!leadCreatedAt || !firstBookedAt) return null;
  const start = Date.parse(leadCreatedAt);
  const end = Date.parse(firstBookedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}
