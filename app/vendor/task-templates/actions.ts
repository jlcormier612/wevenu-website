"use server";

import { revalidatePath } from "next/cache";

import {
  addVendorTaskTemplateItemAttachment,
  applyVendorTaskTemplates,
  createVendorTaskTemplate,
  createVendorTaskTemplateItem,
  deleteVendorTaskTemplate,
  deleteVendorTaskTemplateItem,
  removeVendorTaskTemplateItemAttachment,
  reorderVendorTaskTemplateItems,
  toggleVendorTaskTemplate,
  updateVendorTaskTemplate,
  updateVendorTaskTemplateItem,
} from "@/lib/vendor-task-templates/service";
import type {
  VendorTaskTemplateItemInput,
  VendorTaskTemplatePackInput,
} from "@/lib/vendor-task-templates/types";
import type { VendorActionResult } from "@/lib/vendors/types";

export async function createVendorTaskTemplateAction(
  input: VendorTaskTemplatePackInput,
): Promise<VendorActionResult & { id?: string }> {
  const result = await createVendorTaskTemplate(input);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function updateVendorTaskTemplateAction(
  id: string,
  input: VendorTaskTemplatePackInput,
): Promise<VendorActionResult> {
  const result = await updateVendorTaskTemplate(id, input);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function deleteVendorTaskTemplateAction(id: string): Promise<VendorActionResult> {
  const result = await deleteVendorTaskTemplate(id);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function toggleVendorTaskTemplateAction(
  id: string,
  isActive: boolean,
): Promise<VendorActionResult> {
  const result = await toggleVendorTaskTemplate(id, isActive);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function createVendorTaskTemplateItemAction(
  templateId: string,
  input: VendorTaskTemplateItemInput,
): Promise<VendorActionResult & { id?: string }> {
  const result = await createVendorTaskTemplateItem(templateId, input);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function updateVendorTaskTemplateItemAction(
  itemId: string,
  input: VendorTaskTemplateItemInput,
): Promise<VendorActionResult> {
  const result = await updateVendorTaskTemplateItem(itemId, input);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function deleteVendorTaskTemplateItemAction(
  itemId: string,
): Promise<VendorActionResult> {
  const result = await deleteVendorTaskTemplateItem(itemId);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function reorderVendorTaskTemplateItemsAction(
  templateId: string,
  orderedItemIds: string[],
): Promise<VendorActionResult> {
  const result = await reorderVendorTaskTemplateItems(templateId, orderedItemIds);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function addVendorTaskTemplateItemAttachmentAction(input: {
  itemId: string;
  name: string;
  storagePath: string;
  storageUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
}): Promise<VendorActionResult & { id?: string }> {
  const result = await addVendorTaskTemplateItemAttachment(input);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function removeVendorTaskTemplateItemAttachmentAction(
  attachmentId: string,
): Promise<VendorActionResult> {
  const result = await removeVendorTaskTemplateItemAttachment(attachmentId);
  if (result.ok) revalidatePath("/vendor/task-templates");
  return result;
}

export async function applyVendorTaskTemplatesAction(
  assignmentId: string,
  itemIds: string[],
  coupleVisibility: "private" | "visible" | "owned" = "private",
  opts?: { requireVendorConfirmation?: boolean },
): Promise<VendorActionResult & { createdCount?: number; warnedNoEventDate?: boolean }> {
  const result = await applyVendorTaskTemplates({
    assignmentId,
    itemIds,
    coupleVisibility,
    requireVendorConfirmation: opts?.requireVendorConfirmation,
  });
  if (result.ok) {
    revalidatePath(`/vendor/events/${assignmentId}`);
    revalidatePath("/vendor/dashboard");
    revalidatePath("/vendor/luv");
  }
  return result;
}
