/**
 * Pipeline Templates validation. Pure functions.
 */
import type { PipelineTemplateErrors, PipelineTemplateInput } from "@/lib/pipeline-templates/types";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function validatePipelineTemplateInput(input: PipelineTemplateInput): PipelineTemplateErrors {
  const errors: PipelineTemplateErrors = {};
  if (!input.name.trim()) errors.name = "Give this pipeline a name.";
  if (input.stages.length === 0) errors.stages = "Add at least one stage.";
  if (input.stages.some((s) => !s.name.trim())) errors.stages = "Every stage needs a name.";
  if (input.stages.some((s) => !HEX_RE.test(s.color))) errors.stages = "Every stage needs a valid color.";
  if (input.stages.some((s) => {
    if (!s.probability.trim()) return false;
    const n = Number(s.probability);
    return Number.isNaN(n) || n < 0 || n > 100;
  })) errors.stages = "Probability must be a number between 0 and 100.";
  return errors;
}
