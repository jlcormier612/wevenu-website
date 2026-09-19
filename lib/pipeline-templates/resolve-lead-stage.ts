/**
 * Resolve which venue pipeline stage a lead currently sits in.
 */
import { canonicalForSalesStage } from "@/lib/pipeline-templates/sales-stage-bridge";
import type { PipelineStage } from "@/lib/pipeline-templates/types";
import type { SalesStage } from "@/lib/leads/sales-stages";

export function resolveVenuePipelineStageId(
  stages: PipelineStage[],
  opts: {
    pipelineStageId: string | null | undefined;
    salesStage: SalesStage;
  },
): string | null {
  if (stages.length === 0) return null;
  // Cancelled relationships are not on the active sales board.
  if (opts.salesStage === ("cancelled" as SalesStage)) return null;
  if (opts.pipelineStageId && stages.some((s) => s.id === opts.pipelineStageId)) {
    return opts.pipelineStageId;
  }
  const canonical = canonicalForSalesStage(opts.salesStage);
  const match = stages.find((s) => s.canonicalStage === canonical);
  return match?.id ?? stages[0]?.id ?? null;
}

export function groupLeadsByVenueStage<T extends {
  id: string;
  pipelineStageId?: string | null;
  salesStage: SalesStage;
  status: SalesStage;
}>(
  stages: PipelineStage[],
  leads: T[],
): Map<string, T[]> {
  const cols = new Map<string, T[]>();
  for (const stage of stages) cols.set(stage.id, []);
  for (const lead of leads) {
    const stageId = resolveVenuePipelineStageId(stages, {
      pipelineStageId: lead.pipelineStageId,
      salesStage: lead.salesStage ?? lead.status,
    });
    if (stageId && cols.has(stageId)) {
      cols.get(stageId)!.push(lead);
    }
  }
  return cols;
}
