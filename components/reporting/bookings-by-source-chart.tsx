"use client";

/**
 * Bookings by Source — doughnut for Reporting overview + Sales.
 * Plain SVG (no chart library), matching TrendChart’s dependency-light approach.
 */
import * as React from "react";
import Link from "next/link";

import type { BookingsBySourceReport } from "@/lib/metrics/bookings-by-source";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Tasteful HTC palette — sage family + dusty rose + taupe accents. */
const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-5, var(--soft-sage))",
  "var(--chart-4)",
  "var(--chart-3)",
  "color-mix(in oklch, var(--heritage-sage) 65%, white)",
  "color-mix(in oklch, var(--dusty-rose) 70%, var(--forest-sage))",
  "color-mix(in oklch, var(--taupe-dark) 55%, white)",
  "color-mix(in oklch, var(--heritage-sage) 40%, var(--dusty-rose))",
  "color-mix(in oklch, var(--forest-sage) 50%, var(--taupe-dark))",
];

function colorForIndex(i: number): string {
  return SLICE_COLORS[i % SLICE_COLORS.length]!;
}

type Arc = {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
  d: string;
};

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg;
  if (sweep <= 0) return "";
  // Full circle — SVG arc can't draw 360° in one path; use two halves.
  if (sweep >= 359.999) {
    const mid = startDeg + 180;
    const a0 = polar(cx, cy, rOuter, startDeg);
    const a1 = polar(cx, cy, rOuter, mid);
    const a2 = polar(cx, cy, rOuter, startDeg + 360);
    const b0 = polar(cx, cy, rInner, startDeg + 360);
    const b1 = polar(cx, cy, rInner, mid);
    const b2 = polar(cx, cy, rInner, startDeg);
    return [
      `M ${a0.x} ${a0.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${a1.x} ${a1.y}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${a2.x} ${a2.y}`,
      `L ${b0.x} ${b0.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${b1.x} ${b1.y}`,
      `A ${rInner} ${rInner} 0 1 0 ${b2.x} ${b2.y}`,
      "Z",
    ].join(" ");
  }
  const large = sweep > 180 ? 1 : 0;
  const o0 = polar(cx, cy, rOuter, startDeg);
  const o1 = polar(cx, cy, rOuter, endDeg);
  const i1 = polar(cx, cy, rInner, endDeg);
  const i0 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i0.x} ${i0.y}`,
    "Z",
  ].join(" ");
}

function buildArcs(slices: BookingsBySourceReport["slices"]): Arc[] {
  const total = slices.reduce((a, s) => a + s.count, 0);
  if (total <= 0) return [];
  let angle = 0;
  return slices.map((s, i) => {
    const sweep = (s.count / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return {
      key: s.key,
      label: s.label,
      count: s.count,
      percent: s.percent,
      color: colorForIndex(i),
      d: donutArc(100, 100, 78, 48, start, end),
    };
  });
}

export function BookingsBySourceChart({
  report,
  detailHref,
  className,
  compact = false,
}: {
  report: BookingsBySourceReport;
  /** Optional link under the chart (e.g. open Sales). */
  detailHref?: string;
  className?: string;
  compact?: boolean;
}) {
  const arcs = React.useMemo(() => buildArcs(report.slices), [report.slices]);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const active = arcs.find((a) => a.key === activeKey) ?? null;

  const ariaSummary =
    report.total === 0
      ? "No bookings by source for this period."
      : `Bookings by source. Total ${report.total}. ${report.slices
          .map((s) => `${s.label}: ${s.count}, ${s.percent} percent`)
          .join(". ")}.`;

  return (
    <Card
      className={cn(report.total === 0 ? "htc-report-empty-card" : undefined, className)}
      data-testid="bookings-by-source-chart"
      data-mode={report.mode}
    >
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="text-base">Bookings by Source</CardTitle>
        <CardDescription>{report.basis}</CardDescription>
      </CardHeader>
      <CardContent>
        {report.total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No bookings to show for this period.
          </p>
        ) : (
          <div className={cn("grid gap-6", compact ? "lg:grid-cols-[minmax(0,11rem)_1fr]" : "sm:grid-cols-[minmax(0,14rem)_1fr] items-center")}>
            <div className="relative mx-auto w-full max-w-[14rem]">
              <svg
                viewBox="0 0 200 200"
                className="h-auto w-full"
                role="img"
                aria-label={ariaSummary}
              >
                {arcs.map((arc) => (
                  <path
                    key={arc.key}
                    d={arc.d}
                    fill={arc.color}
                    opacity={activeKey && activeKey !== arc.key ? 0.45 : 1}
                    className="cursor-pointer transition-opacity outline-none focus-visible:opacity-100"
                    tabIndex={0}
                    role="button"
                    aria-label={`${arc.label}: ${arc.count} bookings, ${arc.percent}%`}
                    onMouseEnter={() => setActiveKey(arc.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onFocus={() => setActiveKey(arc.key)}
                    onBlur={() => setActiveKey(null)}
                    onTouchStart={() => setActiveKey(arc.key)}
                  >
                    <title>{`${arc.label}: ${arc.count} (${arc.percent}%)`}</title>
                  </path>
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {active ? active.label : "Total"}
                </p>
                <p className="text-2xl font-semibold tabular-nums text-heading">
                  {active ? active.count : report.total}
                </p>
                {active ? (
                  <p className="text-xs tabular-nums text-muted-foreground">{active.percent}%</p>
                ) : null}
              </div>
            </div>

            <ul className="max-h-[16rem] space-y-1.5 overflow-y-auto pr-1" aria-label="Source legend">
              {report.slices.map((s, i) => {
                const isActive = activeKey === s.key;
                return (
                  <li key={s.key}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm transition-colors",
                        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isActive && "bg-muted/50",
                      )}
                      onMouseEnter={() => setActiveKey(s.key)}
                      onMouseLeave={() => setActiveKey(null)}
                      onFocus={() => setActiveKey(s.key)}
                      onBlur={() => setActiveKey(null)}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorForIndex(i) }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground">{s.label}</span>
                      <span className="shrink-0 tabular-nums font-medium text-heading">{s.count}</span>
                      <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                        {s.percent}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {detailHref ? (
          <p className="mt-4 text-xs text-muted-foreground">
            <Link href={detailHref} className="underline underline-offset-2 hover:text-foreground">
              Open Sales for lead conversion detail
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
