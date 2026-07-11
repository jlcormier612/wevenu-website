/**
 * Automated Series validation. Pure functions.
 */
import type { MessageSequenceInput, SequenceErrors } from "@/lib/message-sequences/types";

export function validateSequenceInput(input: MessageSequenceInput): SequenceErrors {
  const errors: SequenceErrors = {};
  if (!input.name.trim()) errors.name = "Give this series a name.";
  if (input.steps.length === 0) errors.steps = "Add at least one step.";
  if (input.steps.some((s) => !s.templateId)) errors.steps = "Every step needs a template.";
  if (input.steps.some((s) => s.offsetDays < 0)) errors.steps = "A step can't send before the one before it.";
  if (input.triggerType === "lead_stage_changed" && !input.triggerStage) {
    errors.triggerStage = "Choose which pipeline stage starts this series.";
  }
  return errors;
}
