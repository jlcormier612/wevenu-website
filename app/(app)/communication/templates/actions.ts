"use server";

import { revalidatePath } from "next/cache";

import {
  createTemplate, deleteTemplate_, updateTemplate_,
} from "@/lib/message-templates/service";
import type {
  CreateMessageTemplateResult, MessageTemplateActionResult, MessageTemplateCategory, MessageTemplateInput,
} from "@/lib/message-templates/types";
import { proposeMessageTemplate } from "@/lib/luv/message-template-import";
import type { ImportChannel, LuvMessageTemplateProposal } from "@/lib/luv/message-template-import";

export async function createTemplateAction(input: MessageTemplateInput): Promise<CreateMessageTemplateResult> {
  const result = await createTemplate(input);
  if (result.ok) revalidatePath("/communication/templates");
  return result;
}

export async function updateTemplateAction(id: string, input: MessageTemplateInput): Promise<MessageTemplateActionResult> {
  const result = await updateTemplate_(id, input);
  if (result.ok) revalidatePath("/communication/templates");
  return result;
}

export async function deleteTemplateAction(id: string): Promise<MessageTemplateActionResult> {
  const result = await deleteTemplate_(id);
  if (result.ok) revalidatePath("/communication/templates");
  return result;
}

export async function importTemplateAction(
  rawText: string,
  channel: ImportChannel,
  category: MessageTemplateCategory,
): Promise<LuvMessageTemplateProposal> {
  return proposeMessageTemplate(rawText, channel, category);
}
