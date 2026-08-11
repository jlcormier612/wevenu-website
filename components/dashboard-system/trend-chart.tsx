/**
 * Dashboard Component System — Trend Chart (Work Package R1).
 *
 * No chart library exists anywhere in this codebase (confirmed by search —
 * every "LineChart"/"BarChart" hit before this file was a lucide-react
 * icon, not a chart). Reporting is the first real need for one, so this is
 * one shared, deliberately simple bar chart — reused by Sales, Bookings,
 * Revenue, and Events trend sections rather than each report hand-rolling
 * its own (brief §16/§44: "do not build another bespoke chart/card for
 * every report").
 *
 * Plain flexbox bars, not SVG paths — keeps it simple (brief §16: "avoid
 * unnecessary 3D, excessive decoration") and makes every value/label a real
 * DOM text node a screen reader already announces, rather than something
 * requiring a separate accessible-description prop.
 */
import { cn } from "@/lib/utils";

export type TrendPoint = { label: string; value: number };

export function TrendChart({
  data,
  formatValue = (n) => String(n),
  height = 140,
  barColor = "var(--primary)",
}: {
  data: TrendPoint[];
  formatValue?: (n: number) => string;
  height?: number;
  barColor?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  // More than ~14 points and every label would collide — thin them out,
  // the bars themselves still render for every point.
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={`Trend chart: ${data.map((d) => `${d.label} ${formatValue(d.value)}`).join(", ")}`}>
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0);
          return (
            <div key={`${d.label}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full">
              {/* Value labels shown for reasonably small datasets only (e.g. 12 months) — with 30+ points, always-on labels would collide; the chart's own aria-label still carries every value for touch/screen-reader users either way. */}
              {data.length <= 14 && (
                <span className="mb-1 text-xs font-medium text-muted-foreground tabular-nums">
                  {formatValue(d.value)}
                </span>
              )}
              <div
                className="w-full rounded-t-sm transition-all"
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 2 : 0, backgroundColor: barColor }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}-label`} className="flex-1 text-center">
            {i % labelEvery === 0 && <span className="text-xs text-muted-foreground">{d.label}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
