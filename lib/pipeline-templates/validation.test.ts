import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_STAGE_COLOR, PIPELINE_STAGE_COLORS } from "@/lib/pipeline-templates/constants";
import { validatePipelineTemplateInput } from "@/lib/pipeline-templates/validation";
import type { PipelineTemplateInput } from "@/lib/pipeline-templates/types";

function inputWithColor(color: string): PipelineTemplateInput {
  return {
    name: "Wedding Pipeline",
    description: "",
    isActive: true,
    stages: [{ name: "Inquiry", color, canonicalStage: "inquiry", probability: "10" }],
  };
}

test("accepts every controlled pipeline brand color", () => {
  for (const color of PIPELINE_STAGE_COLORS) {
    assert.deepEqual(validatePipelineTemplateInput(inputWithColor(color.value)), {});
  }
  assert.equal(DEFAULT_STAGE_COLOR, PIPELINE_STAGE_COLORS[0].value);
});

test("rejects arbitrary stage colors", () => {
  const errors = validatePipelineTemplateInput(inputWithColor("#FF00AA"));
  assert.equal(errors.stages, "Choose a color from the Hello to Cheers palette.");
});
