"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import {
  addItem, addTemplateItem, addToEventOrder, confirmInventorySelections, createTemplate, deleteTemplate,
  ensureEventInventory, finalizeEventInventory, getTemplate, removeItem, removeTemplateItem,
  reopenEventInventory, replaceEventInventoryFromTemplate, requestInventorySelectionChanges,
  sendInventoryTemplate, setInventoryItemClientSelectable, setTemplateArchived, shareEventInventory,
  updateItem, updateTemplateItem,
} from "@/lib/event-inventory/service";
import type {
  AddItemResult, AddTemplateItemResult, AddToEventOrderResult, CreateTemplateResult, EnsureEventInventoryResult,
  EventInventoryActionResult, EventInventoryCollaborationMode, InventoryItemInput, InventoryTemplateWithItems,
} from "@/lib/event-inventory/types";

/**
 * Event Inventory UI lives on the Booking workspace `/clients/{clientId}`.
 * `/events/{id}` is only a redirect stub — revalidating it alone leaves the
 * inventory panel on stale RSC props (Select click persists, Share stays disabled).
 */
async function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("events")
      .select("client_id")
      .eq("id", eventId)
      .maybeSingle<{ client_id: string | null }>();
    if (data?.client_id) {
      revalidatePath(`/clients/${data.client_id}`);
    }
  } catch {
    // Best-effort: mutation already succeeded; path revalidation must not throw.
  }
  revalidatePath("/clients");
}

export async function ensureEventInventoryAction(eventId: string, templateId: string | null = null): Promise<EnsureEventInventoryResult> {
  const result = await ensureEventInventory(eventId, templateId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Overview setup — replace event inventory items from a Library template (no share/invoice). */
export async function replaceEventInventoryFromTemplateAction(
  eventId: string,
  templateId: string,
): Promise<EnsureEventInventoryResult | EventInventoryActionResult> {
  const result = await replaceEventInventoryFromTemplate(eventId, templateId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function shareEventInventoryAction(
  eventInventoryId: string,
  eventId: string,
  collaborationMode: EventInventoryCollaborationMode = "view",
): Promise<EventInventoryActionResult> {
  const result = await shareEventInventory(eventInventoryId, { collaborationMode });
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function setInventoryItemClientSelectableAction(
  eventInventoryId: string,
  eventId: string,
  itemId: string,
  clientSelectable: boolean,
  maxQuantity?: number | null,
): Promise<EventInventoryActionResult> {
  const result = await setInventoryItemClientSelectable(eventInventoryId, itemId, clientSelectable, maxQuantity);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function confirmInventorySelectionsAction(
  eventInventoryId: string,
  eventId: string,
): Promise<EventInventoryActionResult> {
  const result = await confirmInventorySelections(eventInventoryId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function requestInventorySelectionChangesAction(
  eventInventoryId: string,
  eventId: string,
  note?: string,
): Promise<EventInventoryActionResult> {
  const result = await requestInventorySelectionChanges(eventInventoryId, note);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Apply Inventory Template then share for client portal review. */
export async function sendInventoryTemplateAction(
  eventId: string,
  templateId: string,
): Promise<EnsureEventInventoryResult | EventInventoryActionResult> {
  const result = await sendInventoryTemplate(eventId, templateId);
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

export async function duplicateInventoryTemplateAction(id: string, newName: string): Promise<CreateTemplateResult> {
  const { duplicateTemplate } = await import("@/lib/event-inventory/service");
  const result = await duplicateTemplate(id, newName);
  if (result.ok) revalidatePath("/library/inventory-templates");
  return result;
}

export async function updateInventoryTemplateDetailsAction(
  id: string,
  input: { name: string; description: string | null },
): Promise<EventInventoryActionResult> {
  const { updateTemplateDetails } = await import("@/lib/event-inventory/service");
  const result = await updateTemplateDetails(id, input);
  if (result.ok) {
    revalidatePath("/library/inventory-templates");
    revalidatePath(`/library/inventory-templates/${id}`);
  }
  return result;
}

export async function setInventoryTemplateArchivedAction(id: string, isArchived: boolean): Promise<EventInventoryActionResult> {
  const result = await setTemplateArchived(id, isArchived);
  if (result.ok) revalidatePath("/library/inventory-templates");
  return result;
}

/** Read-only fetch for the Library's Preview sheet — items only, no edit side-effects. */
export async function getInventoryTemplateDetailAction(id: string): Promise<InventoryTemplateWithItems | null> {
  return getTemplate(id);
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

export async function updateInventoryTemplateItemAction(
  templateId: string, itemId: string, input: InventoryItemInput, expectedUpdatedAt: string,
): Promise<EventInventoryActionResult> {
  const result = await updateTemplateItem(itemId, input, expectedUpdatedAt);
  if (result.ok) revalidatePath(`/library/inventory-templates/${templateId}`);
  return result;
}

export async function removeInventoryTemplateItemAction(templateId: string, itemId: string): Promise<EventInventoryActionResult> {
  const result = await removeTemplateItem(itemId);
  if (result.ok) revalidatePath(`/library/inventory-templates/${templateId}`);
  return result;
}
