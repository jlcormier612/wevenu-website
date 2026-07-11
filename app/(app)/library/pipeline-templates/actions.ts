"use server";

import { revalidatePath } from "next/cache";

import {
  createTemplate, deleteTemplate_, setTemplateActive_, updateTemplate_,
} from "@/lib/pipeline-templates/service";
import type {
  CreatePipelineTemplateResult, PipelineTemplateActionResult, PipelineTemplateInput,
} from "@/lib/pipeline-templates/types";

export async function createPipelineTemplateAction(input: PipelineTemplateInput): Promise<CreatePipelineTemplateResult> {
  const result = await createTemplate(input);
  if (result.ok) revalidatePath("/library/pipeline-templates");
  return result;
}

export async function updatePipelineTemplateAction(id: string, input: PipelineTemplateInput): Promise<PipelineTemplateActionResult> {
  const result = await updateTemplate_(id, input);
  if (result.ok) revalidatePath("/library/pipeline-templates");
  return result;
}

export async function deletePipelineTemplateAction(id: string): Promise<PipelineTemplateActionResult> {
  const result = await deleteTemplate_(id);
  if (result.ok) revalidatePath("/library/pipeline-templates");
  return result;
}

export async function setPipelineTemplateActiveAction(id: string, isActive: boolean): Promise<PipelineTemplateActionResult> {
  const result = await setTemplateActive_(id, isActive);
  if (result.ok) revalidatePath("/library/pipeline-templates");
  return result;
}
