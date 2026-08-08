/**
 * Dashboard Component System — canonical Health Summary (Phase 1, Step 5).
 *
 * Implements docs/dashboard-component-system-architecture.md §2.7.
 * Replaces the near-byte-identical shell duplicated between
 * HealthScoreWidget (Venue Health) and VendorHealthScoreWidget (Vendor
 * Health, confirmed dead/unreferenced and deleted in this phase, not
 * migrated). Formulas are unchanged — this component only ever receives
 * an already-computed score/tier/dimensions; it computes nothing itself,
 * per the implementation brief's own "do not alter formulas" rule.
 *
 * Tier colors resolve through lib/dashboard-system/severity.ts's
 * HEALTH_TIER_CONFIG exclusively.
 */
import { HEALTH_TIER_CONFIG } from "@/lib/dashboard-system/severity";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type HealthDimension = { label: string; score: number; percent: number };

function DimensionBar({ label, score, percent }: HealthDimension) {
  const barColor = percent >= 75
    ? "var(--color-success)"
    : percent >= 50
    ? "var(--color-warning)"
    : "var(--color-destructive)";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold text-heading">{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

export function HealthSummary({
  title,
  score,
  tier,
  tierLabel,
  dimensions,
  strengths,
  gaps,
  footnote,
}: {
  title: string;
  score: number;
  tier: "healthy" | "warning" | "critical";
  tierLabel: string;
  dimensions: HealthDimension[];
  strengths: string[];
  gaps: string[];
  /** Rendered as a small trailing note (matches VendorHealthScoreWidget's original luvTip block). */
  footnote?: string;
}) {
  const config = HEALTH_TIER_CONFIG[tier];

  return (
    <Card
      className={config.borderColor}
      style={{ background: `color-mix(in oklch, ${config.bgMix} 3%, var(--card))` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden>{config.emoji}</span>
            <h2 className="font-heading text-sm font-semibold text-heading">{title}</h2>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-bold font-heading leading-none ${config.textColor}`}>
              {score}
            </span>
            <span className={`text-xs font-semibold ${config.textColor} opacity-80`}>
              {tierLabel}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {dimensions.map((d) => (
            <DimensionBar key={d.label} {...d} />
          ))}
        </div>

        {(strengths.length > 0 || gaps.length > 0) && (
          <div className="border-t border-border/40 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-success mb-2">
                  What&apos;s working
                </p>
                <ul className="space-y-1.5">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-success shrink-0 mt-px">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gaps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {strengths.length > 0 ? "Holding you back" : "Areas to improve"}
                </p>
                <ul className="space-y-1.5">
                  {gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-warning-foreground shrink-0 mt-px">·</span>
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {footnote && (
          <div className="border-t border-pink-200/40 pt-3">
            <p className="text-xs text-pink-600 dark:text-pink-400">{footnote}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
