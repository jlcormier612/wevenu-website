/**
 * Automations trigger picker — venue-facing labels only.
 * Internal engineering name remains "sequence"; UI says Automation.
 */
import { LEAD_STATUSES } from "@/lib/leads/constants";
import type { SequenceTriggerType } from "@/lib/message-sequences/types";
import type { AutomationAudience } from "@/lib/message-sequences/platform-triggers";

export type SequenceTriggerOption = {
  value: SequenceTriggerType;
  label: string;
  description: string;
  audience: Exclude<AutomationAudience, "manual">;
};

export const SEQUENCE_TRIGGER_TYPES: SequenceTriggerOption[] = [
  {
    value: "lead_created",
    label: "A new inquiry comes in",
    description: "Starts the moment a lead is added — manually or from your inquiry form.",
    audience: "sales",
  },
  {
    value: "lead_stage_changed",
    label: "A lead reaches a pipeline stage",
    description: "Starts when a lead moves to the stage you choose.",
    audience: "sales",
  },
  {
    value: "tour_completed",
    label: "A tour is completed",
    description: "Starts when a venue tour is marked completed.",
    audience: "sales",
  },
  {
    value: "contract_signed",
    label: "A contract is fully signed",
    description: "Starts when all required client signatures are complete on a contract.",
    audience: "client",
  },
  {
    value: "payment_received",
    label: "A payment is received",
    description: "Starts when a payment is recorded or collected for this relationship.",
    audience: "client",
  },
  {
    value: "questionnaire_submitted",
    label: "A questionnaire is submitted",
    description: "Starts when a client submits a planning questionnaire.",
    audience: "client",
  },
  {
    value: "guest_count_submitted",
    label: "Final guest count is submitted",
    description: "Starts the first time a client submits their final guest count.",
    audience: "client",
  },
  {
    value: "event_completed",
    label: "An event is completed",
    description: "Starts when an event is marked complete — for thank-yous and review asks.",
    audience: "client",
  },
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

export const AUTOMATION_AUDIENCE_LABELS: Record<Exclude<AutomationAudience, "manual">, { title: string; blurb: string }> = {
  sales: { title: "Sales", blurb: "Keep leads moving." },
  client: { title: "Client", blurb: "Keep the relationship moving." },
};
