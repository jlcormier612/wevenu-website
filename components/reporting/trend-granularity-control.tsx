"use client";

/**
 * Compact Day | Week | Month control for reporting time-series charts.
 * Prefer ClientTrendPanel / ClientLinkedTrendCharts for charts that can
 * rebucket locally. This control still updates `grain` without a transition
 * opacity delay so selection feedback is immediate.
 */
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { TrendGranularity } from "@/lib/reporting/trend-buckets";

const LABELS: Record<TrendGranularity, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

export function TrendGranularityControl({
  current,
  available,
  className,
}: {
  current: TrendGranularity;
  available: TrendGranularity[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [optimistic, setOptimistic] = React.useState(current);

  React.useEffect(() => {
    setOptimistic(current);
  }, [current]);

  if (available.length <= 1) return null;

  function select(next: TrendGranularity) {
    if (next === optimistic) return;
    setOptimistic(next);
    const qp = new URLSearchParams(searchParams.toString());
    qp.set("grain", next);
    router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border bg-card p-0.5 text-xs",
        className,
      )}
      role="group"
      aria-label="Chart granularity"
      data-testid="trend-granularity-control"
    >
      {available.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => select(g)}
          aria-pressed={g === optimistic}
          data-testid={`trend-grain-${g}`}
          className={cn(
            "rounded-sm px-2.5 py-1 font-medium transition-colors",
            g === optimistic
              ? "text-heading shadow-sm"
              : "text-muted-foreground hover:text-heading",
          )}
          style={
            g === optimistic
              ? { background: "var(--htc-eucalyptus-surface)" }
              : undefined
          }
        >
          {LABELS[g]}
        </button>
      ))}
    </div>
  );
}
