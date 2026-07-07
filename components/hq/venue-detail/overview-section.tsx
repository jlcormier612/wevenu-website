import { HealthBadge, TrendIndicator } from "@/components/hq/health-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { HqActivationDetail } from "@/lib/hq/venue-detail-types";

const DIMENSION_LABELS: Record<string, { label: string; max: number }> = {
  setup: { label: "Setup", max: 20 },
  couple_engagement: { label: "Couple Engagement", max: 30 },
  workflow: { label: "Workflow", max: 25 },
  team: { label: "Team Adoption", max: 15 },
  habit: { label: "Habit Formation", max: 10 },
};

export function OverviewSection({ activation }: { activation: HqActivationDetail }) {
  const delta = activation.previousScore !== null ? activation.score - activation.previousScore : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HealthBadge status={activation.healthStatus} />
            <TrendIndicator trend={activation.trend} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold font-heading leading-none text-heading">{activation.score}</span>
            <span className="text-xs font-medium text-muted-foreground">/ 100</span>
            {delta !== null && delta !== 0 && (
              <span className={`text-xs font-semibold ${delta > 0 ? "text-success" : "text-muted-foreground"}`}>
                {delta > 0 ? `↑ +${delta}` : `↓ ${delta}`}
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{activation.phaseLabel}</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(DIMENSION_LABELS).map(([key, meta]) => (
            <div key={key} className="rounded-lg border p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{meta.label}</p>
              <p className="mt-1 text-sm font-semibold text-heading">
                {activation.dimensionScores[key] ?? 0}
                <span className="text-muted-foreground font-normal"> / {meta.max}</span>
              </p>
            </div>
          ))}
        </div>

        {activation.gaps.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Next steps for this venue</p>
            <ul className="space-y-1">
              {activation.gaps.map((gap, i) => (
                <li key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>→ {gap.action}</span>
                  <span className="font-semibold text-primary">+{gap.pts} pts</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
