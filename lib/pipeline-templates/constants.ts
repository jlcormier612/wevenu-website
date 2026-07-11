/**
 * Pipeline Templates constants — Phase 1.
 * CANONICAL_STAGES mirrors docs/booking-journey-design.md §1's default
 * journey exactly — this list is fixed and never venue-editable, by design.
 */
import type { CanonicalStage } from "@/lib/pipeline-templates/types";

export const CANONICAL_STAGES: { value: CanonicalStage; label: string; description: string }[] = [
  { value: "inquiry",   label: "Inquiry",   description: "A couple reached out" },
  { value: "tour",      label: "Tour",      description: "A tour is scheduled or has happened" },
  { value: "proposal",  label: "Proposal",  description: "Pricing or a contract was sent" },
  { value: "decision",  label: "Decision",  description: "Waiting on the couple to decide" },
  { value: "booked",    label: "Booked",    description: "They said yes" },
  { value: "lost",      label: "Lost",      description: "Did not book" },
  { value: "cancelled", label: "Cancelled", description: "Booking was cancelled" },
];

export function canonicalStageLabel(stage: CanonicalStage): string {
  return CANONICAL_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

export const DEFAULT_STAGE_COLOR = "#5D6F5D";
