import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { HealthTier, VenueHealthScore } from "@/lib/luv/health-types";

const TIER_CONFIG: Record<HealthTier, { label: string; emoji: string; scoreColor: string; borderColor: string; bgMix: string }> = {
  thriving:        { label: "Thriving",         emoji: "🟢", scoreColor: "text-success",             borderColor: "border-success/25",     bgMix: "var(--success)" },
  growing:         { label: "Growing",          emoji: "🟡", scoreColor: "text-warning-foreground",  borderColor: "border-warning/25",     bgMix: "var(--warning)" },
  needs_attention: { label: "Needs Attention",  emoji: "🔴", scoreColor: "text-destructive",         borderColor: "border-destructive/20", bgMix: "var(--destructive)" },
};

function DimensionBar({ label, score }: { label: string; score: number }) {
  const barColor = score >= 75
    ? "var(--color-success)"
    : score >= 50
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
          style={{ width: `${score}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

export function HealthScoreWidget({ health }: { health: VenueHealthScore }) {
  const tier = TIER_CONFIG[health.tier];
  const dims = Object.values(health.dimensions);

  return (
    <Card
      className={tier.borderColor}
      style={{ background: `color-mix(in oklch, ${tier.bgMix} 3%, var(--card))` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden>{tier.emoji}</span>
            <h2 className="font-heading text-sm font-semibold text-heading">Venue Health</h2>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-bold font-heading leading-none ${tier.scoreColor}`}>
              {health.score}
            </span>
            <span className={`text-xs font-semibold ${tier.scoreColor} opacity-80`}>
              {tier.label}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Dimension bars */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {dims.map((d) => (
            <DimensionBar key={d.label} label={d.label} score={d.score} />
          ))}
        </div>

        {/* Strengths + Gaps explanation */}
        {(health.strengths.length > 0 || health.gaps.length > 0) && (
          <div className="border-t border-border/40 pt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {health.strengths.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-success mb-2">
                  What&apos;s working
                </p>
                <ul className="space-y-1.5">
                  {health.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className="text-success shrink-0 mt-px">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {health.gaps.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  {health.strengths.length > 0 ? "Holding you back" : "Areas to improve"}
                </p>
                <ul className="space-y-1.5">
                  {health.gaps.map((g, i) => (
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
      </CardContent>
    </Card>
  );
}
