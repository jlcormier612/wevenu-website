"use server";

import { revalidatePath } from "next/cache";

import {
  addGroup,
  addOption,
  addSection,
  createTemplate,
  deleteTemplate,
  removeGroup,
  removeOption,
  setTemplateArchived,
  updateTemplate,
} from "@/lib/client-choices-templates/service";
import type { ChoicesTemplateInput } from "@/lib/client-choices-templates/types";

const LIBRARY = "/library/choices-templates";

export async function createChoicesTemplateAction(input: ChoicesTemplateInput) {
  const result = await createTemplate(input);
  if (result.ok) revalidatePath(LIBRARY);
  return result;
}

export async function updateChoicesTemplateAction(id: string, input: ChoicesTemplateInput) {
  const result = await updateTemplate(id, input);
  if (result.ok) {
    revalidatePath(LIBRARY);
    revalidatePath(`${LIBRARY}/${id}`);
  }
  return result;
}

export async function setChoicesTemplateArchivedAction(id: string, archived: boolean) {
  const result = await setTemplateArchived(id, archived);
  if (result.ok) revalidatePath(LIBRARY);
  return result;
}

export async function deleteChoicesTemplateAction(id: string) {
  const result = await deleteTemplate(id);
  if (result.ok) revalidatePath(LIBRARY);
  return result;
}

export async function addChoicesTemplateSectionAction(templateId: string, name: string) {
  const result = await addSection(templateId, name);
  if (result.ok) revalidatePath(`${LIBRARY}/${templateId}`);
  return result;
}

export async function addChoicesTemplateGroupAction(
  templateId: string,
  input: {
    sectionId: string | null;
    name: string;
    instructions?: string;
    selectionMode: "single" | "multi";
    minSelect: number;
    maxSelect: number | null;
    allowQuantity: boolean;
  },
) {
  const result = await addGroup(templateId, input);
  if (result.ok) revalidatePath(`${LIBRARY}/${templateId}`);
  return result;
}

export async function addChoicesTemplateOptionAction(
  templateId: string,
  input: {
    groupId: string;
    offeringId: string | null;
    label: string;
    description?: string;
    isIncluded: boolean;
    unitPrice: number | null;
  },
) {
  const result = await addOption(templateId, input);
  if (result.ok) revalidatePath(`${LIBRARY}/${templateId}`);
  return result;
}

export async function removeChoicesTemplateGroupAction(templateId: string, groupId: string) {
  const result = await removeGroup(groupId);
  if (result.ok) revalidatePath(`${LIBRARY}/${templateId}`);
  return result;
}

export async function removeChoicesTemplateOptionAction(templateId: string, optionId: string) {
  const result = await removeOption(optionId);
  if (result.ok) revalidatePath(`${LIBRARY}/${templateId}`);
  return result;
}
