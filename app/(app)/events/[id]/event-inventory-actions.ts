"use server";

import { revalidatePath } from "next/cache";

import {
  addItem, addTemplateItem, addToEventOrder, createTemplate, deleteTemplate,
  ensureEventInventory, finalizeEventInventory, removeItem, removeTemplateItem,
  reopenEventInventory, setTemplateArchived, shareEventInventory, updateItem,
} from "@/lib/event-inventory/service";
import type {
  AddItemResult, AddTemplateItemResult, AddToEventOrderResult, CreateTemplateResult, EnsureEventInventoryResult,
  EventInventoryActionResult, InventoryItemInput,
} from "@/lib/event-inventory/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

export async function ensureEventInventoryAction(eventId: string, templateId: string | null = null): Promise<EnsureEventInventoryResult> {
  const result = await ensureEventInventory(eventId, templateId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function shareEventInventoryAction(eventInventoryId: string, eventId: string): Promise<EventInventoryActionResult> {
  const result = await shareEventInventory(eventInventoryId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function finalizeEventInventoryAction(eventInventoryId: string, eventId: string): Promise<EventInventoryActionResult> {
  const result = await finalizeEventInventory(eventInventoryId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reopenEventInventoryAction(eventInventoryId: string, eventId: string): Promise<EventInventoryActionResult> {
  const result = await reopenEventInventory(eventInventoryId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addEventInventoryItemAction(eventInventoryId: string, eventId: string, input: InventoryItemInput): Promise<AddItemResult> {
  const result = await addItem(eventInventoryId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateEventInventoryItemAction(
  eventInventoryId: string, eventId: string, itemId: string, input: InventoryItemInput, expectedUpdatedAt: string,
): Promise<EventInventoryActionResult> {
  const result = await updateItem(eventInventoryId, itemId, input, expectedUpdatedAt);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeEventInventoryItemAction(eventInventoryId: string, eventId: string, itemId: string, itemName: string): Promise<EventInventoryActionResult> {
  const result = await removeItem(eventInventoryId, itemId, itemName);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addEventInventoryToEventOrderAction(eventInventoryId: string, eventId: string): Promise<AddToEventOrderResult> {
  const result = await addToEventOrder(eventInventoryId, eventId);
  if (result.ok) {
    revalidateEvent(eventId);
  }
  return result;
}

// ---- templates (Library) ----------------------------------------------------------

export async function createInventoryTemplateAction(name: string, description: string): Promise<CreateTemplateResult> {
  const result = await createTemplate(name, description);
  if (result.ok) revalidatePath("/library/inventory-templates");
  return result;
}

export async function setInventoryTemplateArchivedAction(id: string, isArchived: boolean): Promise<EventInventoryActionResult> {
  const result = await setTemplateArchived(id, isArchived);
  if (result.ok) revalidatePath("/library/inventory-templates");
  return result;
}

export async function addInventoryTemplateStarterAgainAction(
  masterKey: "INV-01" | "INV-02",
): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const { addInventoryTemplateStarterAgain } = await import("@/lib/inventory/provision");
  const result = await addInventoryTemplateStarterAgain(masterKey);
  if (result.ok) {
    revalidatePath("/library/inventory-templates");
    revalidatePath("/library/inventory");
    revalidatePath("/library");
  }
  return result;
}

export async function deleteInventoryTemplateAction(id: string): Promise<EventInventoryActionResult> {
  const result = await deleteTemplate(id);
  if (result.ok) revalidatePath("/library/inventory-templates");
  return result;
}

export async function addInventoryTemplateItemAction(templateId: string, input: InventoryItemInput): Promise<AddTemplateItemResult> {
  const result = await addTemplateItem(templateId, input);
  if (result.ok) revalidatePath(`/library/inventory-templates/${templateId}`);
  return result;
}

export async function removeInventoryTemplateItemAction(templateId: string, itemId: string): Promise<EventInventoryActionResult> {
  const result = await removeTemplateItem(itemId);
  if (result.ok) revalidatePath(`/library/inventory-templates/${templateId}`);
  return result;
}
