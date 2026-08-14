"use server";

import { revalidatePath } from "next/cache";

import {
  addEventOrderStarterAgain,
} from "@/lib/event-order-templates/provision";
import {
  addLine, addSection, createTemplate, deleteTemplate_, duplicateTemplate_,
  removeLine, removeSection, setTemplateArchived_, updateTemplate_,
} from "@/lib/event-order-templates/service";
import type { EventOrderStarterMasterKey } from "@/lib/event-order-templates/starters";
import type {
  AddTemplateLineInput, AddTemplateLineResult, AddTemplateSectionResult,
  CreateEventOrderTemplateResult, EventOrderTemplateActionResult, EventOrderTemplateInput,
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

export async function addEventOrderTemplateSectionAction(templateId: string, name: string): Promise<AddTemplateSectionResult> {
  const result = await addSection(templateId, name);
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

export async function removeEventOrderTemplateLineAction(templateId: string, lineId: string): Promise<EventOrderTemplateActionResult> {
  const result = await removeLine(lineId);
  if (result.ok) revalidateLibrary(templateId);
  return result;
}

export async function addEventOrderStarterAgainAction(
  masterKey: EventOrderStarterMasterKey,
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const result = await addEventOrderStarterAgain(masterKey);
  if (result.ok) revalidateLibrary(result.templateId);
  return result;
}
