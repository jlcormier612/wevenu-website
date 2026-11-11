/**
 * Canonical Standard sales pipeline — product baseline for every new venue.
 * Venue-facing stage names/order/colors/probabilities are locked here.
 * Source of truth matches the saved Sandbox Standard configuration.
 */
import type { CanonicalStage } from "@/lib/pipeline-templates/types";
import { PIPELINE_STAGE_COLORS } from "@/lib/pipeline-templates/constants";

export const STANDARD_PIPELINE_NAME = "Standard";

export const STANDARD_PIPELINE_DESCRIPTION =
  "Default sales pipeline. Active for every new venue — no setup required.";

/** Palette swatch indexes into PIPELINE_STAGE_COLORS (0-based). */
const SWATCH = {
  heritageSage: PIPELINE_STAGE_COLORS[0].value, // #5D6F5D
  forestSage: PIPELINE_STAGE_COLORS[1].value, // #4F5F4F
  softSage: PIPELINE_STAGE_COLORS[2].value, // #B9D1C2
  warmTaupe: PIPELINE_STAGE_COLORS[3].value, // #B8AEA1
  linen: PIPELINE_STAGE_COLORS[4].value, // #DED6CA
  dustyRose: PIPELINE_STAGE_COLORS[5].value, // #D8A7AA
} as const;

export type StandardPipelineStageDef = {
  name: string;
  canonicalStage: CanonicalStage;
  probability: number;
  color: string;
};

/**
 * Locked Standard stages (active pipeline columns).
 * Probabilities: 10, 20, 50, 60, 85, 70, 95, 0
 * Colors: Soft Sage, Forest Sage, Soft Sage, Linen, Warm Taupe, Forest Sage, Heritage Sage, Dusty Rose
 */
export const STANDARD_PIPELINE_STAGES: readonly StandardPipelineStageDef[] = [
  { name: "New Inquiry", canonicalStage: "inquiry", probability: 10, color: SWATCH.softSage },
  { name: "In Workflow", canonicalStage: "inquiry", probability: 20, color: SWATCH.forestSage },
  { name: "Tour Scheduled", canonicalStage: "tour", probability: 50, color: SWATCH.softSage },
  { name: "Custom Proposal", canonicalStage: "proposal", probability: 60, color: SWATCH.linen },
  { name: "Contract Sent", canonicalStage: "proposal", probability: 85, color: SWATCH.warmTaupe },
  { name: "Follow-Up", canonicalStage: "decision", probability: 70, color: SWATCH.forestSage },
  { name: "Booked", canonicalStage: "booked", probability: 95, color: SWATCH.heritageSage },
  { name: "Lost", canonicalStage: "lost", probability: 0, color: SWATCH.dustyRose },
] as const;

export const STANDARD_PIPELINE_STAGE_NAMES = STANDARD_PIPELINE_STAGES.map((s) => s.name);

export const STANDARD_PIPELINE_PROBABILITIES = STANDARD_PIPELINE_STAGES.map((s) => s.probability);

export const STANDARD_PIPELINE_COLORS = STANDARD_PIPELINE_STAGES.map((s) => s.color);
