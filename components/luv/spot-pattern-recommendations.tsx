import { RecommendationsPanel } from "@/components/dashboard/recommendations-panel";
import { getVenueRecommendations } from "@/lib/luv/recommendation-service";
import { isRecommendationActiveForDisplay } from "@/lib/luv/recommendation-visibility";
import {
  INQUIRY_VOLUME_INCREASE_TYPE,
  PAYMENT_ATTENTION_PATTERN_TYPE,
  UNATTENDED_INQUIRY_PATTERN_TYPE,
  type Phase5SpotPatternType,
} from "@/lib/luv/spot-patterns";

/** Inquiry workflow L2 patterns (Leads). */
export const LEADS_SPOT_PATTERN_TYPES: Phase5SpotPatternType[] = [
  UNATTENDED_INQUIRY_PATTERN_TYPE,
  INQUIRY_VOLUME_INCREASE_TYPE,
];

/** Payments workflow L2 patterns. */
export const PAYMENTS_SPOT_PATTERN_TYPES: Phase5SpotPatternType[] = [
  PAYMENT_ATTENTION_PATTERN_TYPE,
];

/**
 * Phase 5 Spot Patterns — L2 workflow surface only.
 * Never Dashboard L1 (see isDashboardLevel1Recommendation).
 */
export async function SpotPatternRecommendationsPanel({
  types,
}: {
  types: readonly Phase5SpotPatternType[];
}) {
  const all = await getVenueRecommendations();
  const allow = new Set<string>(types);
  const recommendations = all.filter(
    (rec) => allow.has(rec.type) && isRecommendationActiveForDisplay(rec),
  );
  if (recommendations.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-4 py-1"
      aria-label="Luv patterns"
    >
      <RecommendationsPanel recommendations={recommendations} />
    </section>
  );
}
