"use server";

import { revalidatePath } from "next/cache";

import {
  addObject, clearTemplate, createTemplate, createTemplateFromPaste, deleteObject_,
  duplicateTemplate, renameTemplate_, reorderObject, setBackgroundLocked, setTemplateArchived_,
  setTemplateDefault_, updateBackground, updateObject_, updateRoomSettings,
} from "@/lib/floor-plan-templates/service";
import type {
  CreateFloorPlanTemplateResult, FloorPlanTemplateActionResult, FloorPlanTemplateObject, ImportFloorPlanTemplateResult,
} from "@/lib/floor-plan-templates/types";
import type {
  AddObjectInput, FloorPlanActionResult, ReorderDirection, UpdateObjectInput, UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";

function revalidateLibrary() {
  revalidatePath("/library/floor-plan-templates");
}

export async function createTemplateAction(
  name: string, eventType: string | null, spaceId: string | null, isDefault?: boolean,
): Promise<CreateFloorPlanTemplateResult> {
  const result = await createTemplate(name, eventType, spaceId, isDefault);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function renameTemplateAction(id: string, name: string): Promise<FloorPlanTemplateActionResult> {
  const result = await renameTemplate_(id, name);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function setTemplateDefaultAction(id: string): Promise<FloorPlanTemplateActionResult> {
  const result = await setTemplateDefault_(id);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function setTemplateArchivedAction(id: string, isArchived: boolean): Promise<FloorPlanTemplateActionResult> {
  const result = await setTemplateArchived_(id, isArchived);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function duplicateTemplateAction(
  sourceTemplateId: string, newName: string, isDefault?: boolean,
): Promise<CreateFloorPlanTemplateResult> {
  const result = await duplicateTemplate(sourceTemplateId, newName, isDefault);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function createTemplateFromPasteAction(
  rawText: string, name: string, eventType: string | null, spaceId: string | null, isDefault?: boolean,
): Promise<ImportFloorPlanTemplateResult> {
  const result = await createTemplateFromPaste(rawText, name, eventType, spaceId, isDefault);
  if (result.ok) revalidateLibrary();
  return result;
}

// ---- Editor (template mode) --------------------------------------------------
// Same shape as app/(app)/events/[id]/floor-plan-actions.ts, pointed at
// floor_plan_templates instead — the editor itself is unmodified.

export async function addTemplateObjectAction(
  templateId: string, input: AddObjectInput,
): Promise<{ ok: true; object: FloorPlanTemplateObject } | FloorPlanActionResult> {
  const result = await addObject(templateId, input);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}

export async function updateTemplateObjectAction(objId: string, input: UpdateObjectInput): Promise<FloorPlanActionResult> {
  return updateObject_(objId, input);
}

export async function deleteTemplateObjectAction(objId: string, templateId: string): Promise<FloorPlanActionResult> {
  const result = await deleteObject_(objId);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}

export async function clearTemplateAction(templateId: string): Promise<FloorPlanActionResult> {
  const result = await clearTemplate(templateId);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}

export async function updateTemplateBackgroundAction(
  templateId: string, url: string | null, opacity: number,
): Promise<FloorPlanActionResult> {
  const result = await updateBackground(templateId, url, opacity);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}

export async function setTemplateBackgroundLockedAction(
  templateId: string, locked: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setBackgroundLocked(templateId, locked);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}

export async function updateTemplateRoomSettingsAction(
  templateId: string, input: UpdateRoomSettingsInput,
): Promise<FloorPlanActionResult> {
  const result = await updateRoomSettings(templateId, input);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}

export async function reorderTemplateObjectAction(
  templateId: string, objId: string, direction: ReorderDirection,
): Promise<FloorPlanActionResult> {
  const result = await reorderObject(templateId, objId, direction);
  if (result.ok) revalidatePath(`/library/floor-plan-templates/${templateId}`);
  return result;
}
