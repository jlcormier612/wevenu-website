"use client";

/**
 * Reporting trend card with immediate Day/Week/Month switching.
 *
 * Observations are loaded once with the date range. Changing grain only
 * rebuckets locally and syncs the URL — no RSC reload, no second DB fetch.
 */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  observationsToTrend,
  type TrendObservation,
} from "@/lib/reporting/aggregate-trend";
import type { TrendGranularity } from "@/lib/reporting/trend-buckets";

const LABELS: Record<TrendGranularity, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export function ClientTrendPanel({
  title,
  /** Text after the grain caption, e.g. "view of leads received during This Month." */
  descriptionSuffix,
  window,
  initialGrain,
  available,
  observations,
  emptyText,
  formatValue,
  barColor,
  className,
  testId,
}: {
  title: string;
  descriptionSuffix: string;
  window: { from: string; to: string };
  initialGrain: TrendGranularity;
  available: TrendGranularity[];
  observations: TrendObservation[];
  emptyText: string;
  formatValue?: (n: number) => string;
  barColor?: string;
  className?: string;
  testId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [grain, setGrain] = React.useState(initialGrain);

  React.useEffect(() => {
    setGrain(initialGrain);
  }, [initialGrain, window.from, window.to]);

  const series = React.useMemo(
    () => observationsToTrend(observations, window, grain),
    [observations, window, grain],
  );
  const hasData = observations.length > 0 && series.points.some((p) => p.value > 0);

  function select(next: TrendGranularity) {
    if (next === grain) return;
    setGrain(next);
    const qp = new URLSearchParams(searchParams.toString());
    qp.set("grain", next);
    // Fire-and-forget URL sync — chart already updated from local state.
    router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
  }

  return (
    <Card
      className={cn(!hasData ? "htc-report-empty-card" : undefined, className)}
      data-testid={testId}
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            {series.granularityLabel} {descriptionSuffix}
          </CardDescription>
        </div>
        {available.length > 1 ? (
          <div
            className="inline-flex rounded-md border border-border bg-card p-0.5 text-xs"
            role="group"
            aria-label="Chart granularity"
            data-testid="trend-granularity-control"
          >
            {available.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => select(g)}
                aria-pressed={g === grain}
                data-testid={`trend-grain-${g}`}
                className={cn(
                  "rounded-sm px-2.5 py-1 font-medium transition-colors",
                  g === grain
                    ? "text-heading shadow-sm"
                    : "text-muted-foreground hover:text-heading",
                )}
                style={
                  g === grain
                    ? { background: "var(--htc-eucalyptus-surface)" }
                    : undefined
                }
              >
                {LABELS[g]}
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <TrendChart data={series.points} formatValue={formatValue} barColor={barColor} />
        )}
      </CardContent>
    </Card>
  );
}
