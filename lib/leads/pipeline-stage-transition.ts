/**
 * Shared pipeline stage-transition classification.
 * Booked / Lost detection uses reporting category (canonical_stage), never
 * venue-facing stage display names.
 */
import { salesStageForCanonical } from "@/lib/pipeline-templates/sales-stage-bridge";
import type { CanonicalStage, PipelineStage } from "@/lib/pipeline-templates/types";
import type { SalesStage } from "@/lib/leads/sales-stages";
import { isSalesStage } from "@/lib/leads/sales-stages";

export type StageTransitionKind = "booked" | "lost" | "normal";

export function transitionKindForCanonical(canonical: CanonicalStage | string | null | undefined): StageTransitionKind {
  if (canonical === "booked") return "booked";
  if (canonical === "lost" || canonical === "cancelled") return "lost";
  return "normal";
}

export function transitionKindForVenueStage(stage: Pick<PipelineStage, "canonicalStage">): StageTransitionKind {
  return transitionKindForCanonical(stage.canonicalStage);
}

/** Fixed board (no custom template): sales_stage key is the target. */
export function transitionKindForSalesStageKey(key: string): StageTransitionKind {
  if (key === "booked") return "booked";
  if (key === "lost") return "lost";
  return "normal";
}

export function resolveTransitionKind(opts: {
  targetKey: string;
  venueStages?: PipelineStage[] | null;
}): StageTransitionKind {
  if (opts.venueStages?.length) {
    const stage = opts.venueStages.find((s) => s.id === opts.targetKey);
    if (stage) return transitionKindForVenueStage(stage);
  }
  return transitionKindForSalesStageKey(opts.targetKey);
}

export function salesStageForTransitionTarget(opts: {
  targetKey: string;
  venueStages?: PipelineStage[] | null;
  fallback?: SalesStage;
}): SalesStage | null {
  if (opts.venueStages?.length) {
    const stage = opts.venueStages.find((s) => s.id === opts.targetKey);
    if (!stage) return null;
    return salesStageForCanonical(stage.canonicalStage, opts.fallback ?? "new_inquiry");
  }
  return isSalesStage(opts.targetKey) ? opts.targetKey : null;
}
