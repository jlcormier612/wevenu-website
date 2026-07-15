"use server";

import { revalidatePath } from "next/cache";

import {
  addCustomLine, addLineFromInventory, addLineFromPackage, addSection,
  ensureEventOrder, finalizeEventOrder, removeLine, removeSection, reopenEventOrder,
  setSectionFloorPlan,
} from "@/lib/event-orders/service";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddLineResult, AddSectionResult,
  EnsureEventOrderResult, EventOrderActionResult,
} from "@/lib/event-orders/types";
import { createInvoice, linkInvoiceToEventOrder } from "@/lib/invoices/service";
import type { CreateInvoiceResult, InvoiceActionResult as InvoiceOpResult } from "@/lib/invoices/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

export async function ensureEventOrderAction(eventId: string): Promise<EnsureEventOrderResult> {
  const result = await ensureEventOrder(eventId);
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

/** Phase 4 — links (or clears) which Floor Plan this Section reconciles against. */
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

export async function addLineFromPackageAction(
  eventOrderId: string, eventId: string, packageId: string, packageName: string, basePrice: number, sectionId: string | null,
): Promise<AddLineResult> {
  const result = await addLineFromPackage(eventOrderId, packageId, packageName, basePrice, sectionId);
  if (result.ok) revalidateEvent(eventId);
  return result;
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

export async function removeLineAction(eventOrderId: string, eventId: string, lineId: string, lineDescription: string): Promise<EventOrderActionResult> {
  const result = await removeLine(eventOrderId, lineId, lineDescription);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/**
 * Booking Financial Architecture Phase 3a. Creates a brand-new Draft
 * invoice, already linked, from the Event Order panel — for an Event that
 * has no invoice at all yet.
 */
export async function createInvoiceFromEventOrderAction(
  eventOrderId: string, eventId: string, clientId: string,
): Promise<CreateInvoiceResult> {
  const result = await createInvoice({ clientId, eventId, notes: "", dueDate: "", eventOrderId });
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/**
 * Booking Financial Architecture Phase 3a. Links an already-existing Draft
 * invoice (most commonly Phase 1's retainer invoice) to this Event Order,
 * rather than forcing a second invoice into existence — "one Invoice per
 * Event, growing over time" (Decision 5) still holds once Event Order
 * enters the picture.
 */
export async function linkEventOrderToInvoiceAction(eventOrderId: string, eventId: string, invoiceId: string): Promise<InvoiceOpResult> {
  const result = await linkInvoiceToEventOrder(invoiceId, eventOrderId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}
