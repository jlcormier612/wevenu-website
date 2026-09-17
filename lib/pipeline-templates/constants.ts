/**
 * Pipeline Templates constants — Phase 1.
 * CANONICAL_STAGES mirrors docs/booking-journey-design.md §1's default
 * journey exactly — this list is fixed and never venue-editable, by design.
 */
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

export const CANONICAL_STAGES: { value: CanonicalStage; label: string; description: string }[] = [
  { value: "inquiry",   label: "Inquiry",   description: "Early interest — reporting bucket, not your stage name" },
  { value: "tour",      label: "Tour",      description: "Visit / site walk-through reporting bucket" },
  { value: "proposal",  label: "Proposal",  description: "Pricing or offer sent — reporting bucket" },
  { value: "decision",  label: "Decision",  description: "Waiting on a yes/no — reporting bucket" },
  { value: "booked",    label: "Booked",    description: "Won / booking file started — reporting bucket" },
  { value: "lost",      label: "Lost",      description: "Did not book — reporting bucket" },
  { value: "cancelled", label: "Cancelled", description: "Booking cancelled — reporting bucket" },
];

export function canonicalStageLabel(stage: CanonicalStage): string {
  return CANONICAL_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

/**
 * Controlled Hello to Cheers palette for pipeline stages.
 * These are product-owned brand colors, not venue-entered arbitrary hex
 * values. The editor may choose only from this set and the server validates
 * the same constraint so the rule cannot be bypassed through the API.
 */
export const PIPELINE_STAGE_COLORS = [
  { value: "#5D6F5D", label: "Heritage Sage" },
  { value: "#4F5F4F", label: "Forest Sage" },
  { value: "#B9D1C2", label: "Soft Sage" },
  { value: "#B8AEA1", label: "Warm Taupe" },
  { value: "#DED6CA", label: "Linen" },
  { value: "#D8A7AA", label: "Dusty Rose" },
  { value: "#6F6A61", label: "Stone" },
] as const;

export const PIPELINE_STAGE_COLOR_VALUES = PIPELINE_STAGE_COLORS.map((c) => c.value);
export const DEFAULT_STAGE_COLOR = PIPELINE_STAGE_COLORS[0].value;

export function pipelineStageColorForIndex(index: number): string {
  return PIPELINE_STAGE_COLORS[index % PIPELINE_STAGE_COLORS.length].value;
}
