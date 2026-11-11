/**
 * Pure helpers: advance one stage on the venue's active customizable Pipeline
 * when a Lead enters an Automation (update_pipeline_on_enroll).
 *
 * Never hard-codes a destination stage name. Never wraps from the final stage.
 */
import { resolveVenuePipelineStageId } from "@/lib/pipeline-templates/resolve-lead-stage";
import { salesStageForCanonical } from "@/lib/pipeline-templates/sales-stage-bridge";
import { transitionKindForCanonical } from "@/lib/leads/pipeline-stage-transition";
import {
  SALES_STAGES,
  isForwardSalesStageMove,
  isSalesStage,
  type SalesStage,
} from "@/lib/leads/sales-stages";
import type { PipelineStage } from "@/lib/pipeline-templates/types";

export type AdvancePipelineTarget =
  | { kind: "pipeline"; stageId: string; salesStage: SalesStage }
  | { kind: "sales_stage"; salesStage: SalesStage }
  | null;

/**
 * Next open (non-booked / non-lost) stage one step forward on the active
 * template, or null if already at the last open stage / no safe next.
 */
export function nextActivePipelineStage(
  stages: PipelineStage[],
  opts: {
    pipelineStageId: string | null | undefined;
    salesStage: SalesStage;
  },
): AdvancePipelineTarget {
  if (stages.length === 0) return null;

  const currentId = resolveVenuePipelineStageId(stages, {
    pipelineStageId: opts.pipelineStageId,
    salesStage: opts.salesStage,
  });
  if (!currentId) return null;

  const idx = stages.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= stages.length - 1) return null;

  const next = stages[idx + 1]!;
  if (transitionKindForCanonical(next.canonicalStage) !== "normal") {
    // Do not auto-advance into Booked / Lost / Cancelled.
    return null;
  }

  const salesStage = salesStageForCanonical(next.canonicalStage, opts.salesStage);
  return { kind: "pipeline", stageId: next.id, salesStage };
}

/**
 * Fallback when the venue has no active Pipeline Template: advance exactly one
 * open sales_stage key forward. No wrap; never invent a stage past the last open.
 */
export function nextOpenSalesStage(current: SalesStage): SalesStage | null {
  if (current === "booked" || current === "lost") return null;
  const open: SalesStage[] = SALES_STAGES.filter((s) => s !== "booked" && s !== "lost");
  const idx = open.indexOf(current);
  if (idx < 0 || idx >= open.length - 1) return null;
  const next = open[idx + 1]!;
  if (!isForwardSalesStageMove(current, next)) return null;
  return next;
}

export function resolveAdvanceOnEnrollTarget(opts: {
  stages: PipelineStage[] | null | undefined;
  pipelineStageId: string | null | undefined;
  salesStage: string;
}): AdvancePipelineTarget {
  if (!isSalesStage(opts.salesStage)) return null;
  if (opts.salesStage === "booked" || opts.salesStage === "lost") return null;

  if (opts.stages && opts.stages.length > 0) {
    return nextActivePipelineStage(opts.stages, {
      pipelineStageId: opts.pipelineStageId,
      salesStage: opts.salesStage,
    });
  }

  const next = nextOpenSalesStage(opts.salesStage);
  return next ? { kind: "sales_stage", salesStage: next } : null;
}
