/**
 * Shared Bookings-by-Source breakdown for Reporting overview + Sales.
 *
 * Pure aggregation on already-resolved acquisition sources. Callers choose the
 * cohort (period first_booked vs lead-created) and pass one row per qualifying
 * lifecycle booking (or lead-who-booked when that is the report definition).
 */
import {
  groupCountsByReportingSource,
  reportingSourceDisplayLabel,
  UNKNOWN_SOURCE_KEY,
} from "@/lib/attribution/source";

export type BookingsBySourceSlice = {
  key: string;
  label: string;
  count: number;
  /** Integer percent 0–100; slices sum to 100 when total > 0 (largest remainder). */
  percent: number;
};

export type BookingsBySourceBreakdown = {
  total: number;
  slices: BookingsBySourceSlice[];
};

/**
 * Largest-remainder method so displayed percents always sum to 100 when
 * total > 0. Empty input → empty slices, total 0.
 */
export function allocateIntegerPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (100 * c) / total);
  const floors = exact.map((n) => Math.floor(n));
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((n, i) => ({ i, frac: n - floors[i]! }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (let k = 0; k < order.length && remainder > 0; k++) {
    out[order[k]!.i]! += 1;
    remainder -= 1;
  }
  return out;
}

/** Build chart slices from raw acquisition_source values (one per booking). */
export function buildBookingsBySourceBreakdown(
  sources: Array<string | null | undefined>,
): BookingsBySourceBreakdown {
  const grouped = groupCountsByReportingSource(sources.map((source) => ({ source })));
  const total = grouped.reduce((a, r) => a + r.count, 0);
  if (total === 0) return { total: 0, slices: [] };
  const percents = allocateIntegerPercents(grouped.map((r) => r.count));
  return {
    total,
    slices: grouped.map((r, i) => ({
      key: r.key,
      label: r.label,
      count: r.count,
      percent: percents[i] ?? 0,
    })),
  };
}

/** Build from pre-aggregated {key,count} rows (e.g. cohort eventuallyBooked). */
export function buildBookingsBySourceBreakdownFromCounts(
  rows: Array<{ key: string; count: number; label?: string }>,
): BookingsBySourceBreakdown {
  const filtered = rows
    .filter((r) => r.count > 0)
    .map((r) => ({
      key: r.key || UNKNOWN_SOURCE_KEY,
      label: r.label ?? reportingSourceDisplayLabel(r.key === UNKNOWN_SOURCE_KEY ? null : r.key),
      count: r.count,
    }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_SOURCE_KEY) return 1;
      if (b.key === UNKNOWN_SOURCE_KEY) return -1;
      return b.count - a.count;
    });
  const total = filtered.reduce((a, r) => a + r.count, 0);
  if (total === 0) return { total: 0, slices: [] };
  const percents = allocateIntegerPercents(filtered.map((r) => r.count));
  return {
    total,
    slices: filtered.map((r, i) => ({
      ...r,
      percent: percents[i] ?? 0,
    })),
  };
}

/** Concise copy for the reporting period basis. */
export const BOOKINGS_BY_SOURCE_PERIOD_BASIS =
  "Bookings first marked booked during the selected period, by the frozen source recorded when the lead arrived. Missing source is Not recorded.";

export const BOOKINGS_BY_SOURCE_COHORT_BASIS =
  "Booked events from leads created during the selected period, by the frozen source recorded when each lead arrived. A lead that books after these dates still counts here. Missing source is Not recorded.";
