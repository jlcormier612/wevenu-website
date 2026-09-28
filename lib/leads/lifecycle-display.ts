/**
 * Customer-facing sales lifecycle label.
 *
 * Authoritative source: leads.sales_stage (fixed seven-stage model).
 * Venue pipeline_stage_id / Standard column names (e.g. "In Workflow")
 * must not override this label on lead detail, list, or board.
 */
import { salesStageLabel } from "@/lib/leads/sales-stages";

export function customerFacingLifecycleLabel(
  salesStage: string | null | undefined,
): string {
  return salesStageLabel(salesStage);
}

/**
 * Primary lifecycle label for a lead row. pipeline_stage_id and venue
 * column names are accepted only so callers can pass them — they are ignored.
 */
export function primaryLifecycleLabel(opts: {
  salesStage: string | null | undefined;
  pipelineStageId?: string | null;
  venuePipelineStageName?: string | null;
}): string {
  void opts.pipelineStageId;
  void opts.venuePipelineStageName;
  return customerFacingLifecycleLabel(opts.salesStage);
}
