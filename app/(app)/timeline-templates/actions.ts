"use server";

import { revalidatePath } from "next/cache";

import {
  addItem, createTemplate, createTemplateFromImport, deleteItem_, duplicateTemplate,
  renameTemplate_, reorderItems_, setTemplateArchived_, setTemplateDefault_, updateItem_,
} from "@/lib/timeline-templates/service";
import type {
  CreateTimelineTemplateResult, ImportTimelineTemplateResult, TimelineTemplateActionResult, TimelineTemplateItemInput,
} from "@/lib/timeline-templates/types";

export async function createTemplateAction(name: string, eventType: string | null, spaceId: string | null): Promise<CreateTimelineTemplateResult> {
  const result = await createTemplate(name, eventType, spaceId);
  if (result.ok) revalidatePath("/library/timeline-templates");
  return result;
}

export async function renameTemplateAction(id: string, name: string): Promise<TimelineTemplateActionResult> {
  const result = await renameTemplate_(id, name);
  if (result.ok) revalidatePath("/library/timeline-templates");
  return result;
}

export async function setTemplateDefaultAction(id: string): Promise<TimelineTemplateActionResult> {
  const result = await setTemplateDefault_(id);
  if (result.ok) revalidatePath("/library/timeline-templates");
  return result;
}

export async function setTemplateArchivedAction(id: string, isArchived: boolean): Promise<TimelineTemplateActionResult> {
  const result = await setTemplateArchived_(id, isArchived);
  if (result.ok) revalidatePath("/library/timeline-templates");
  return result;
}

export async function duplicateTemplateAction(sourceTemplateId: string, newName: string): Promise<CreateTimelineTemplateResult> {
  const result = await duplicateTemplate(sourceTemplateId, newName);
  if (result.ok) revalidatePath("/library/timeline-templates");
  return result;
}

export async function createTemplateFromImportAction(rawText: string, name: string, eventType: string | null, spaceId: string | null): Promise<ImportTimelineTemplateResult> {
  const result = await createTemplateFromImport(rawText, name, eventType, spaceId);
  if (result.ok) revalidatePath("/library/timeline-templates");
  return result;
}

export async function addItemAction(templateId: string, input: TimelineTemplateItemInput): Promise<TimelineTemplateActionResult & { itemId?: string }> {
  const result = await addItem(templateId, input);
  if (result.ok) revalidatePath(`/library/timeline-templates/${templateId}`);
  return result;
}

export async function updateItemAction(itemId: string, templateId: string, patch: Partial<TimelineTemplateItemInput>): Promise<TimelineTemplateActionResult> {
  const result = await updateItem_(itemId, patch);
  if (result.ok) revalidatePath(`/library/timeline-templates/${templateId}`);
  return result;
}

export async function deleteItemAction(itemId: string, templateId: string): Promise<TimelineTemplateActionResult> {
  const result = await deleteItem_(itemId);
  if (result.ok) revalidatePath(`/library/timeline-templates/${templateId}`);
  return result;
}

export async function reorderItemsAction(templateId: string, orderedItemIds: string[]): Promise<TimelineTemplateActionResult> {
  const result = await reorderItems_(orderedItemIds);
  if (result.ok) revalidatePath(`/library/timeline-templates/${templateId}`);
  return result;
}
