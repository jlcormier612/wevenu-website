"use server";

import { revalidatePath } from "next/cache";

import {
  addEventOrderStarterAgain,
} from "@/lib/event-order-templates/provision";
import {
  addGroup, addLine, addOption, addSection, createTemplate, deleteTemplate_,
  duplicateTemplate_, getTemplate, removeGroup_, removeLine, removeOption_,
  removeSection, reorderGroups, reorderLines, reorderOptions, reorderSections,
  setTemplateArchived_, updateGroup_, updateLine, updateOption_, updateSection,
  updateSectionGuidance, updateTemplate_,
} from "@/lib/event-order-templates/service";
import type { EventOrderStarterMasterKey } from "@/lib/event-order-templates/starters";
import type {
  AddTemplateGroupInput, AddTemplateGroupResult, AddTemplateLineInput, AddTemplateLineResult,
  AddTemplateOptionInput, AddTemplateOptionResult, AddTemplateSectionResult,
  CreateEventOrderTemplateResult, EventOrderTemplateActionResult, EventOrderTemplateInput,
  EventOrderTemplateWithDetails, UpdateTemplateLineInput,
} from "@/lib/event-order-templates/types";

function revalidateLibrary(templateId?: string) {
  revalidatePath("/library/event-order-templates");
  revalidatePath("/library");
  if (templateId) revalidatePath(`/library/event-order-templates/${templateId}`);
}

export async function createEventOrderTemplateAction(input: EventOrderTemplateInput): Promise<CreateEventOrderTemplateResult> {
  const result = await createTemplate(input);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function updateEventOrderTemplateAction(id: string, input: EventOrderTemplateInput): Promise<EventOrderTemplateActionResult> {
  const result = await updateTemplate_(id, input);
  if (result.ok) revalidateLibrary(id);
  return result;
}

export async function setEventOrderTemplateArchivedAction(id: string, isArchived: boolean): Promise<EventOrderTemplateActionResult> {
  const result = await setTemplateArchived_(id, isArchived);
  if (result.ok) revalidateLibrary(id);
  return result;
}

export async function deleteEventOrderTemplateAction(id: string): Promise<EventOrderTemplateActionResult> {
  const result = await deleteTemplate_(id);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function duplicateEventOrderTemplateAction(id: string, newName: string): Promise<CreateEventOrderTemplateResult> {
  const result = await duplicateTemplate_(id, newName);
  if (result.ok) revalidateLibrary();
  return result;
}

export async function addEventOrderTemplateSectionAction(
  templateId: string, name: string, guidance?: string | null,
): Promise<AddTemplateSectionResult> {
  const result = await addSection(templateId, name, guidance ?? null);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function updateEventOrderTemplateSectionGuidanceAction(
  templateId: string, sectionId: string, guidance: string | null,
): Promise<EventOrderTemplateActionResult> {
  const result = await updateSectionGuidance(sectionId, guidance);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function updateEventOrderTemplateSectionAction(
  templateId: string, sectionId: string, input: { name?: string; guidance?: string | null },
): Promise<EventOrderTemplateActionResult> {
  const result = await updateSection(sectionId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function reorderEventOrderTemplateSectionsAction(
  templateId: string, orderedIds: string[],
): Promise<EventOrderTemplateActionResult> {
  const result = await reorderSections(orderedIds);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function removeEventOrderTemplateSectionAction(templateId: string, sectionId: string): Promise<EventOrderTemplateActionResult> {
  const result = await removeSection(sectionId);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function addEventOrderTemplateLineAction(templateId: string, input: AddTemplateLineInput): Promise<AddTemplateLineResult> {
  const result = await addLine(templateId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function updateEventOrderTemplateLineAction(
  templateId: string, lineId: string, input: UpdateTemplateLineInput,
): Promise<EventOrderTemplateActionResult> {
  const result = await updateLine(lineId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function reorderEventOrderTemplateLinesAction(
  templateId: string, orderedIds: string[],
): Promise<EventOrderTemplateActionResult> {
  const result = await reorderLines(orderedIds);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function removeEventOrderTemplateLineAction(templateId: string, lineId: string): Promise<EventOrderTemplateActionResult> {
  const result = await removeLine(lineId);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function addEventOrderTemplateGroupAction(
  templateId: string, input: AddTemplateGroupInput,
): Promise<AddTemplateGroupResult> {
  const result = await addGroup(templateId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function updateEventOrderTemplateGroupAction(
  templateId: string, groupId: string, input: AddTemplateGroupInput,
): Promise<EventOrderTemplateActionResult> {
  const result = await updateGroup_(groupId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function reorderEventOrderTemplateGroupsAction(
  templateId: string, orderedIds: string[],
): Promise<EventOrderTemplateActionResult> {
  const result = await reorderGroups(orderedIds);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function removeEventOrderTemplateGroupAction(
  templateId: string, groupId: string,
): Promise<EventOrderTemplateActionResult> {
  const result = await removeGroup_(groupId);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function addEventOrderTemplateOptionAction(
  templateId: string, input: AddTemplateOptionInput,
): Promise<AddTemplateOptionResult> {
  const result = await addOption(templateId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function updateEventOrderTemplateOptionAction(
  templateId: string, optionId: string, input: AddTemplateOptionInput,
): Promise<EventOrderTemplateActionResult> {
  const result = await updateOption_(optionId, input);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function reorderEventOrderTemplateOptionsAction(
  templateId: string, orderedIds: string[],
): Promise<EventOrderTemplateActionResult> {
  const result = await reorderOptions(orderedIds);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function removeEventOrderTemplateOptionAction(
  templateId: string, optionId: string,
): Promise<EventOrderTemplateActionResult> {
  const result = await removeOption_(optionId);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

/** Read-only fetch for the Library's Preview sheet — sections + lines + groups, no edit side-effects. */
export async function getEventOrderTemplateDetailAction(id: string): Promise<EventOrderTemplateWithDetails | null> {
  return getTemplate(id);
}

export async function addEventOrderStarterAgainAction(
  masterKey: EventOrderStarterMasterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const result = await addEventOrderStarterAgain(masterKey);
  if (result.ok) revalidateLibrary(result.templateId);
  return result;
}
