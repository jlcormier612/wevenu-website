/**
 * Automated Series validation. Pure functions.
 */
import { SEQUENCE_TRIGGER_STAGES } from "@/lib/message-sequences/constants";
import type { MessageSequenceInput, SequenceErrors } from "@/lib/message-sequences/types";

const VALID_TRIGGER_STAGES = new Set(SEQUENCE_TRIGGER_STAGES.map((s) => s.value));

export function validateSequenceInput(input: MessageSequenceInput): SequenceErrors {
  const errors: SequenceErrors = {};
  if (!input.name.trim()) errors.name = "Give this series a name.";
  if (input.steps.length === 0) errors.steps = "Add at least one step.";
  if (input.steps.some((s) => !s.templateId)) errors.steps = "Every step needs a template.";
  if (input.steps.some((s) => s.offsetDays < 0)) errors.steps = "A step can't send before the one before it.";
  if (input.triggerType === "lead_stage_changed") {
    if (!input.triggerStage) {
      errors.triggerStage = "Choose which pipeline stage starts this series.";
    } else if (!VALID_TRIGGER_STAGES.has(input.triggerStage)) {
      errors.triggerStage = "Choose a valid pipeline stage.";
    }
  }
  return errors;
}
