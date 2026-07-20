import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { HqActivationDetail } from "@/lib/hq/venue-detail-types";
import type { LuvObservation } from "@/lib/luv/types";

const KIND_ICON: Record<LuvObservation["kind"], string> = {
  celebration: "🎉", risk: "⚠", waiting: "⏳", recommendation: "→", inference: "◆", fact: "·",
};

/**
 * Luv Experience Completion, Work Stream 1 — the real observation engine
 * (lib/luv/observations.ts), called for an arbitrary venue rather than the
 * logged-in one. This used to be a self-documented v1 placeholder computed
 * from beta-scoring's own risk signals; it now reads the same engine every
 * coordinator's own dashboard reads, for consistency across audiences.
 * `activation`'s healthStatus is kept for the subtitle — a distinct,
 * still-valid beta-activation concept, not something Luv's observations
 * replace.
 */
export function LuvInsights({ activation, observations }: { activation: HqActivationDetail; observations: LuvObservation[] }) {
  const { healthStatus } = activation;
  const top = observations.slice(0, 6);

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
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">No leading-indicator risk signals detected — this venue is progressing normally.</p>
        ) : (
          <ul className="space-y-1.5">
            {top.map((o) => (
              <li key={o.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className={`mt-0.5 ${o.kind === "risk" ? "text-warning" : o.kind === "celebration" ? "text-primary" : ""}`} aria-hidden>{KIND_ICON[o.kind]}</span>
                {o.message}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
