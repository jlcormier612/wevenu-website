"use server";

import { revalidatePath } from "next/cache";

import {
  addCustomLine, addLineFromInventory, addLineFromOffering, addLineFromPackage, addSection,
  ensureEventOrder, finalizeEventOrder, importPackageInclusions, removeLine, removeSection,
  reopenEventOrder, setSectionFloorPlan, updateLine,
} from "@/lib/event-orders/service";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddLineResult, AddOfferingLineInput,
  AddSectionResult, EnsureEventOrderResult, EventOrderActionResult, UpdateLineInput,
} from "@/lib/event-orders/types";
import { createInvoice, linkInvoiceToEventOrder } from "@/lib/invoices/service";
import type { CreateInvoiceResult, InvoiceActionResult as InvoiceOpResult } from "@/lib/invoices/types";
import { getEventOrderPdfUrl, shareEventOrderWithClient } from "@/lib/event-orders/representation";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

export async function ensureEventOrderAction(eventId: string, templateId?: string | null): Promise<EnsureEventOrderResult> {
  const result = await ensureEventOrder(eventId, templateId ?? null);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function finalizeEventOrderAction(eventOrderId: string, eventId: string): Promise<EventOrderActionResult> {
  const result = await finalizeEventOrder(eventOrderId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reopenEventOrderAction(eventOrderId: string, eventId: string): Promise<EventOrderActionResult> {
  const result = await reopenEventOrder(eventOrderId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addSectionAction(eventOrderId: string, eventId: string, name: string): Promise<AddSectionResult> {
  const result = await addSection(eventOrderId, name);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeSectionAction(eventOrderId: string, eventId: string, sectionId: string, sectionName: string): Promise<EventOrderActionResult> {
  const result = await removeSection(eventOrderId, sectionId, sectionName);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function setSectionFloorPlanAction(
  eventOrderId: string, eventId: string, sectionId: string, floorPlanId: string | null,
): Promise<EventOrderActionResult> {
  const result = await setSectionFloorPlan(eventOrderId, sectionId, floorPlanId);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidatePath(`/events/${eventId}/floor-plans`);
  }
  return result;
}

export async function addLineFromOfferingAction(
  eventOrderId: string, eventId: string, input: AddOfferingLineInput,
): Promise<AddLineResult> {
  const result = await addLineFromOffering(eventOrderId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Advanced / legacy: bundled package fee — not primary Add path. */
export async function addLineFromPackageAction(
  eventOrderId: string, eventId: string, packageId: string, packageName: string, basePrice: number, sectionId: string | null,
): Promise<AddLineResult> {
  const result = await addLineFromPackage(eventOrderId, packageId, packageName, basePrice, sectionId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function importPackageInclusionsAction(
  eventOrderId: string,
  eventId: string,
  items: { description: string; quantity: number; unit: string | null }[],
  sectionId: string | null,
): Promise<EventOrderActionResult & { addedCount?: number }> {
  const result = await importPackageInclusions(eventOrderId, items, sectionId);
  if (result.ok) revalidateEvent(eventId);
  return result as EventOrderActionResult & { addedCount?: number };
}

export async function addLineFromInventoryAction(eventOrderId: string, eventId: string, input: AddInventoryLineInput): Promise<AddLineResult> {
  const result = await addLineFromInventory(eventOrderId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function addCustomLineAction(eventOrderId: string, eventId: string, input: AddCustomLineInput): Promise<AddLineResult> {
  const result = await addCustomLine(eventOrderId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateLineAction(
  eventOrderId: string, eventId: string, lineId: string, input: UpdateLineInput,
): Promise<AddLineResult> {
  const result = await updateLine(eventOrderId, lineId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function removeLineAction(eventOrderId: string, eventId: string, lineId: string, lineDescription: string): Promise<EventOrderActionResult> {
  const result = await removeLine(eventOrderId, lineId, lineDescription);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Secondary: create draft invoice linked to EO. Not the primary EO action. */
export async function createInvoiceFromEventOrderAction(
  eventOrderId: string, eventId: string, clientId: string,
): Promise<CreateInvoiceResult> {
  const result = await createInvoice({ clientId, eventId, notes: "", dueDate: "", eventOrderId });
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function linkEventOrderToInvoiceAction(eventOrderId: string, eventId: string, invoiceId: string): Promise<InvoiceOpResult> {
  const result = await linkInvoiceToEventOrder(invoiceId, eventOrderId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function shareEventOrderWithClientAction(eventOrderId: string, eventId: string, customMessage?: string): Promise<EventOrderActionResult> {
  const result = await shareEventOrderWithClient(eventOrderId, customMessage);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function getEventOrderPdfUrlAction(eventOrderId: string) {
  return getEventOrderPdfUrl(eventOrderId);
}
