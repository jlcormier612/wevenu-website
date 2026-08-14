import { HealthSummary } from "@/components/dashboard-system/health-summary";
import type { HealthTier, VenueHealthScore } from "@/lib/luv/health-types";

const TIER_LABEL: Record<HealthTier, string> = {
  thriving:        "Thriving",
  growing:         "Growing",
  needs_attention: "Needs Attention",
};

const TIER_SEVERITY: Record<HealthTier, "healthy" | "warning" | "critical"> = {
  thriving:        "healthy",
  growing:         "warning",
  needs_attention: "critical",
};

// Dashboard Component System, Phase 1 Step 5 (docs/dashboard-component-
// system-architecture.md §2.7) — shell migrated to the canonical
// HealthSummary; formula/data unchanged (health.score, health.tier,
// health.dimensions, health.strengths, health.gaps all pass through
// exactly as computed by lib/luv/health-service.ts).
export function HealthScoreWidget({ health }: { health: VenueHealthScore }) {
  return (
    <HealthSummary
      title="Venue Health"
      score={health.score}
      tier={TIER_SEVERITY[health.tier]}
      tierLabel={TIER_LABEL[health.tier]}
      dimensions={Object.values(health.dimensions).map((d) => ({ label: d.label, score: d.score, percent: d.score }))}
      strengths={health.strengths}
      gaps={health.gaps}
    />
  );
}
