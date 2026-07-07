import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { HqActivationDetail } from "@/lib/hq/venue-detail-types";

/**
 * v1: a rules-based "why" narrative generated directly from the risk
 * signals and gaps already computed for this venue (lib/hq/beta-scoring.ts).
 * Wiring the full Luv observation engine (trends/memory/story mode) to run
 * for an arbitrary venue from HQ — rather than the logged-in venue itself —
 * is a deliberate future hook, not built in this pass. See
 * docs/wevenu-hq-architecture.md §2.6.
 */
export function LuvInsights({ activation }: { activation: HqActivationDetail }) {
  const { healthStatus, riskSignals, gaps } = activation;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span aria-hidden>💗</span>
          <h2 className="font-heading text-sm font-semibold text-heading">Luv Insights</h2>
        </div>
        <p className="text-xs text-muted-foreground">Why this venue is {healthStatus === "healthy" ? "healthy" : healthStatus === "at_risk" ? "at risk" : "critical"}.</p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {riskSignals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leading-indicator risk signals detected — this venue is progressing normally.</p>
        ) : (
          <ul className="space-y-1.5">
            {riskSignals.map((s) => (
              <li key={s.code} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 text-warning" aria-hidden>⚠</span>
                {s.label}
              </li>
            ))}
          </ul>
        )}

        {gaps.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Highest-impact next step</p>
            <p className="text-xs text-heading">→ {gaps[0].action} <span className="text-primary font-semibold">+{gaps[0].pts} pts</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
