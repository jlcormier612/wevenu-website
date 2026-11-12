/**
 * Pure trend aggregation — shared by server reports and client grain switching.
 * Grain changes rebucket already-loaded observations; they do not re-fetch.
 */
import type { TrendPoint } from "@/components/dashboard-system/trend-chart";
import {
  bucketKeyForTimestamp,
  buildTrendBuckets,
  resolveTrendGranularity,
  trendGranularityCaption,
  type TrendGranularity,
} from "@/lib/reporting/trend-buckets";

export type DateWindow = { from: string; to: string };

export type TrendObservation = {
  /** ISO timestamp or YYYY-MM-DD. */
  at: string;
  /** Defaults to 1 (count series). */
  amount?: number;
};

export type TrendSeries = {
  points: TrendPoint[];
  granularity: TrendGranularity;
  granularityLabel: string;
};

export function emptyTrend(
  window: DateWindow,
  granularityOverride?: TrendGranularity,
): TrendSeries {
  const granularity = granularityOverride ?? resolveTrendGranularity(window.from, window.to);
  const buckets = buildTrendBuckets(window.from, window.to, granularity);
  return {
    points: buckets.map((b) => ({ label: b.label, value: 0 })),
    granularity,
    granularityLabel: trendGranularityCaption(granularity),
  };
}

export function observationsToTrend(
  observations: TrendObservation[],
  window: DateWindow,
  granularityOverride?: TrendGranularity,
): TrendSeries {
  const granularity = granularityOverride ?? resolveTrendGranularity(window.from, window.to);
  const buckets = buildTrendBuckets(window.from, window.to, granularity);
  const totals = new Map<string, number>();
  for (const obs of observations) {
    if (!obs.at) continue;
    const key = bucketKeyForTimestamp(obs.at, granularity);
    totals.set(key, (totals.get(key) ?? 0) + (obs.amount ?? 1));
  }
  return {
    points: buckets.map((b) => ({
      label: b.label,
      value: Math.round(totals.get(b.key) ?? 0),
    })),
    granularity,
    granularityLabel: trendGranularityCaption(granularity),
  };
}

export function timestampsToTrend(
  timestamps: string[],
  window: DateWindow,
  granularityOverride?: TrendGranularity,
): TrendSeries {
  return observationsToTrend(
    timestamps.map((at) => ({ at })),
    window,
    granularityOverride,
  );
}
