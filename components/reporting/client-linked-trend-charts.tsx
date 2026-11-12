"use client";

/**
 * Two (or more) reporting trend charts that share one Day/Week/Month control.
 * Observations are already loaded — grain only rebuckets locally.
 */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { TrendChart } from "@/components/dashboard-system/trend-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/event-orders/constants";
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

export type LinkedTrendChartSpec = {
  title: string;
  /** Text after the grain caption (no functions — RSC-safe). */
  descriptionSuffix: string;
  observations: TrendObservation[];
  emptyText: string;
  valueFormat?: "number" | "money";
  barColor?: string;
  testId?: string;
};

export function ClientLinkedTrendCharts({
  window,
  initialGrain,
  available,
  charts,
}: {
  window: { from: string; to: string };
  initialGrain: TrendGranularity;
  available: TrendGranularity[];
  charts: LinkedTrendChartSpec[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [grain, setGrain] = React.useState(initialGrain);

  React.useEffect(() => {
    setGrain(initialGrain);
  }, [initialGrain, window.from, window.to]);

  function select(next: TrendGranularity) {
    if (next === grain) return;
    setGrain(next);
    const qp = new URLSearchParams(searchParams.toString());
    qp.set("grain", next);
    router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      {available.length > 1 ? (
        <div className="flex justify-end">
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
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {charts.map((chart) => {
          const series = observationsToTrend(chart.observations, window, grain);
          const hasData =
            chart.observations.length > 0 && series.points.some((p) => p.value > 0);
          return (
            <Card
              key={chart.title}
              className={!hasData ? "htc-report-empty-card" : undefined}
              data-testid={chart.testId}
            >
              <CardHeader>
                <CardTitle className="text-base">{chart.title}</CardTitle>
                <CardDescription>
                  {series.granularityLabel} {chart.descriptionSuffix}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!hasData ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{chart.emptyText}</p>
                ) : (
                  <TrendChart
                    data={series.points}
                    formatValue={
                      chart.valueFormat === "money" ? formatMoney : (n) => String(n)
                    }
                    barColor={chart.barColor}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
