/**
 * Automated Series constants — Communication Platform Phase 3.
 */
import type { SequenceTriggerType } from "@/lib/message-sequences/types";

// Deliberately small, real, and already-observable — not an exhaustive
// trigger vocabulary. HoneyBook's breadth (§1.5) is the aim over time, built
// out from real usage rather than invented wholesale here.
export const SEQUENCE_TRIGGER_TYPES: { value: SequenceTriggerType; label: string; description: string }[] = [
  { value: "lead_created",       label: "A new inquiry comes in",       description: "Starts the moment a lead is added — manually or from your inquiry form." },
  { value: "lead_stage_changed", label: "A lead reaches a pipeline stage", description: "Starts when a lead moves to the stage you choose." },
];

// Mirrors LEAD_STATUSES (lib/leads/constants.ts) — kept as a separate,
// smaller list here on purpose: "won" and "lost"/"cancelled" are real
// stages a lead can reach, but enrolling a Series *on* the moment a lead is
// won contradicts "stop on booking" (§3.3) firing at that same instant, and
// lost/cancelled implies nothing further should go out at all. Only the
// stages that plausibly want a follow-up series are offered.
export const SEQUENCE_TRIGGER_STAGES: { value: string; label: string }[] = [
  { value: "new",           label: "New" },
  { value: "contacted",     label: "Contacted" },
  { value: "qualified",     label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
];
