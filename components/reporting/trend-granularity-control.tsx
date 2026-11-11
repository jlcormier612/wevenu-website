"use client";

/**
 * Compact Day | Week | Month control for reporting time-series charts.
 * Updates the `grain` search param without changing the selected date range.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

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
  const [pending, startTransition] = useTransition();

  if (available.length <= 1) return null;

  function select(next: TrendGranularity) {
    if (next === current) return;
    const qp = new URLSearchParams(searchParams.toString());
    qp.set("grain", next);
    startTransition(() => {
      router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-border bg-card p-0.5 text-xs",
        pending && "opacity-70",
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
          aria-pressed={g === current}
          className={cn(
            "rounded-sm px-2.5 py-1 font-medium transition-colors",
            g === current
              ? "text-heading shadow-sm"
              : "text-muted-foreground hover:text-heading",
          )}
          style={
            g === current
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
