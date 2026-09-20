/**
 * Canonical Standard sales pipeline — product baseline for every new venue.
 * Venue-facing stage names/order live here; canonicalStage is the reporting bridge.
 */
import type { CanonicalStage } from "@/lib/pipeline-templates/types";
import { pipelineStageColorForIndex } from "@/lib/pipeline-templates/constants";

export const STANDARD_PIPELINE_NAME = "Standard";

export const STANDARD_PIPELINE_DESCRIPTION =
  "Default sales pipeline. Active for every new venue — no setup required.";

export type StandardPipelineStageDef = {
  name: string;
  canonicalStage: CanonicalStage;
  probability: number;
  color: string;
};

/**
 * Locked Standard stages (active pipeline columns).
 * Booked and Lost are outcomes at the end of the journey.
 */
export const STANDARD_PIPELINE_STAGES: readonly StandardPipelineStageDef[] = [
  { name: "New Inquiry", canonicalStage: "inquiry", probability: 10, color: pipelineStageColorForIndex(0) },
  { name: "In Workflow", canonicalStage: "inquiry", probability: 25, color: pipelineStageColorForIndex(1) },
  { name: "Tour Scheduled", canonicalStage: "tour", probability: 50, color: pipelineStageColorForIndex(2) },
  { name: "Custom Proposal", canonicalStage: "proposal", probability: 70, color: pipelineStageColorForIndex(3) },
  { name: "Contract Sent", canonicalStage: "proposal", probability: 85, color: pipelineStageColorForIndex(4) },
  { name: "Follow-Up", canonicalStage: "decision", probability: 90, color: pipelineStageColorForIndex(5) },
  { name: "Booked", canonicalStage: "booked", probability: 100, color: pipelineStageColorForIndex(6) },
  { name: "Lost", canonicalStage: "lost", probability: 0, color: pipelineStageColorForIndex(0) },
] as const;

export const STANDARD_PIPELINE_STAGE_NAMES = STANDARD_PIPELINE_STAGES.map((s) => s.name);
