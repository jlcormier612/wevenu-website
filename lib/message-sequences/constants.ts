/**
 * Automated Series constants — Communication Platform Phase 3.
 */
import { LEAD_STATUSES } from "@/lib/leads/constants";
import type { SequenceTriggerType } from "@/lib/message-sequences/types";

// Deliberately small, real, and already-observable — not an exhaustive
// trigger vocabulary. HoneyBook's breadth (§1.5) is the aim over time, built
// out from real usage rather than invented wholesale here.
export const SEQUENCE_TRIGGER_TYPES: { value: SequenceTriggerType; label: string; description: string }[] = [
  { value: "lead_created",       label: "A new inquiry comes in",       description: "Starts the moment a lead is added — manually or from your inquiry form." },
  { value: "lead_stage_changed", label: "A lead reaches a pipeline stage", description: "Starts when a lead moves to the stage you choose." },
  { value: "tour_completed",     label: "A tour is completed",          description: "Starts when a venue tour is marked completed." },
];

/**
 * Stage picker values = all LeadStatus values. Stored on
 * message_sequences.trigger_stage as LeadStatus (not venue-customized
 * Pipeline stage names). Venue stage names are resolved at render time.
 */
export const SEQUENCE_TRIGGER_STAGES: { value: string; label: string }[] = LEAD_STATUSES.map((s) => ({
  value: s.value,
  label: s.label,
}));
