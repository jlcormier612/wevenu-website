"use client";

/**
 * Generic source / composition doughnut for Reporting.
 * Plain SVG (no chart library), matching TrendChart’s dependency-light approach.
 */
import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type CompositionSlice = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

/**
 * Hospitality palette ordered to alternate dark / light / rose / taupe so
 * adjacent doughnut segments stay distinguishable. Never invent off-brand hues.
 */
const SLICE_COLORS = [
  "var(--chart-1)", // heritage sage (dark)
  "var(--chart-5)", // soft sage (light)
  "var(--chart-4)", // dusty rose
  "var(--chart-3)", // taupe
  "var(--chart-2)", // forest sage (dark) — separated from chart-1 by three steps
  "color-mix(in oklch, var(--soft-sage) 55%, white)",
  "color-mix(in oklch, var(--dusty-rose) 55%, white)",
  "color-mix(in oklch, var(--taupe-dark) 45%, white)",
  "color-mix(in oklch, var(--heritage-sage) 55%, var(--dusty-rose))",
  "color-mix(in oklch, var(--soft-sage) 40%, var(--taupe-dark))",
];

const DARK_GREEN = new Set([
  "var(--chart-1)",
  "var(--chart-2)",
]);

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function preferredColor(key: string): string {
  return SLICE_COLORS[hashKey(key) % SLICE_COLORS.length]!;
}

function nextDistinct(from: string, avoid: string | undefined): string {
  const start = Math.max(0, SLICE_COLORS.indexOf(from));
  for (let step = 0; step < SLICE_COLORS.length; step++) {
    const candidate = SLICE_COLORS[(start + step) % SLICE_COLORS.length]!;
    if (!avoid) return candidate;
    if (candidate === avoid) continue;
    if (DARK_GREEN.has(candidate) && DARK_GREEN.has(avoid)) continue;
    return candidate;
  }
  return from;
}

/** Stable per-key colors with adjacent-segment conflict resolution. */
export function assignCompositionColors(slices: { key: string }[]): string[] {
  const colors: string[] = [];
  for (let i = 0; i < slices.length; i++) {
    const preferred = preferredColor(slices[i]!.key);
    colors.push(nextDistinct(preferred, colors[i - 1]));
  }
  return colors;
}

type Arc = CompositionSlice & { color: string; d: string };

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

function buildArcs(slices: CompositionSlice[]): Arc[] {
  const total = slices.reduce((a, s) => a + s.count, 0);
  if (total <= 0) return [];
  const colors = assignCompositionColors(slices);
  let angle = 0;
  return slices.map((s, i) => {
    const sweep = (s.count / total) * 360;
    const start = angle;
    const end = angle + sweep;
    angle = end;
    return {
      ...s,
      color: colors[i]!,
      d: donutArc(100, 100, 78, 48, start, end),
    };
  });
}

export function SourceCompositionChart({
  title,
  description,
  slices,
  total,
  emptyText,
  unitSingular = "item",
  unitPlural = "items",
  detailHref,
  detailLabel,
  className,
  compact = false,
  testId,
}: {
  title: string;
  description: string;
  slices: CompositionSlice[];
  total: number;
  emptyText: string;
  unitSingular?: string;
  unitPlural?: string;
  detailHref?: string;
  detailLabel?: string;
  className?: string;
  compact?: boolean;
  testId?: string;
}) {
  const arcs = React.useMemo(() => buildArcs(slices), [slices]);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const active = arcs.find((a) => a.key === activeKey) ?? null;
  const unit = total === 1 ? unitSingular : unitPlural;

  const ariaSummary =
    total === 0
      ? emptyText
      : `${title}. Total ${total} ${unit}. ${slices
          .map((s) => `${s.label}: ${s.count}, ${s.percent} percent`)
          .join(". ")}.`;

  return (
    <Card
      className={cn(total === 0 ? "htc-report-empty-card" : undefined, className)}
      data-testid={testId}
    >
      <CardHeader className={compact ? "pb-2" : undefined}>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <div
            className={cn(
              "grid gap-6",
              compact
                ? "lg:grid-cols-[minmax(0,11rem)_1fr]"
                : "sm:grid-cols-[minmax(0,14rem)_1fr] items-center",
            )}
          >
            <div className="relative mx-auto w-full max-w-[14rem]">
              <svg viewBox="0 0 200 200" className="h-auto w-full" role="img" aria-label={ariaSummary}>
                {arcs.map((arc) => (
                  <path
                    key={arc.key}
                    d={arc.d}
                    fill={arc.color}
                    opacity={activeKey && activeKey !== arc.key ? 0.45 : 1}
                    className="cursor-pointer transition-opacity outline-none focus-visible:opacity-100"
                    tabIndex={0}
                    role="button"
                    aria-label={`${arc.label}: ${arc.count} ${arc.count === 1 ? unitSingular : unitPlural}, ${arc.percent}%`}
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
                  {active ? active.count : total}
                </p>
                {active ? (
                  <p className="text-xs tabular-nums text-muted-foreground">{active.percent}%</p>
                ) : null}
              </div>
            </div>

            <ul className="max-h-[16rem] space-y-1.5 overflow-y-auto pr-1" aria-label={`${title} legend`}>
              {arcs.map((s) => {
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
                        style={{ backgroundColor: s.color }}
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
              {detailLabel ?? "Open detail"}
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
