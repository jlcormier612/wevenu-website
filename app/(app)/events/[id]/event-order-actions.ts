"use server";

import { revalidatePath } from "next/cache";

import {
  addCustomLine, addLineFromInventory, addLineFromOffering, addLineFromPackage, addSection,
  applyTemplateToEventOrder, ensureEventOrder, finalizeEventOrder, importPackageInclusions, removeLine, removeSection,
  reopenEventOrder, replaceEventOrderFromTemplate, setSectionFloorPlan, startOrApplyEventOrderTemplate, updateLine,
} from "@/lib/event-orders/service";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddLineResult, AddOfferingLineInput,
  AddSectionResult, EnsureEventOrderResult, EventOrderActionResult, UpdateLineInput,
} from "@/lib/event-orders/types";
import type { TemplateApplySelection } from "@/lib/event-order-templates/offerings";
import {
  sendEventOrderTemplate,
  useEventOrderTemplate,
} from "@/lib/event-order-templates/use-send";
import type { ChoicesAnswers } from "@/lib/client-choices/types";
import { createInvoice, linkInvoiceToEventOrder } from "@/lib/invoices/service";
import type { CreateInvoiceResult, InvoiceActionResult as InvoiceOpResult } from "@/lib/invoices/types";
import { getEventOrderPdfUrl, shareEventOrderWithClient } from "@/lib/event-orders/representation";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/clients/${eventId}`);
}

export async function ensureEventOrderAction(
  eventId: string,
  templateId?: string | null,
  selections?: TemplateApplySelection[],
): Promise<EnsureEventOrderResult> {
  const result = await ensureEventOrder(eventId, templateId ?? null, selections);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function applyEventOrderTemplateAction(
  eventOrderId: string,
  eventId: string,
  templateId: string,
  selections?: TemplateApplySelection[],
): Promise<EventOrderActionResult> {
  const result = await applyTemplateToEventOrder(eventOrderId, templateId, selections);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function startOrApplyEventOrderTemplateAction(
  eventId: string,
  templateId: string,
  selections?: TemplateApplySelection[],
): Promise<EnsureEventOrderResult> {
  const result = await startOrApplyEventOrderTemplate(eventId, templateId, selections);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Overview setup — replace open Event Order contents from a Library Event Order template (no share/invoice). */
export async function replaceEventOrderFromTemplateAction(
  eventId: string,
  templateId: string,
): Promise<EnsureEventOrderResult | EventOrderActionResult> {
  const result = await replaceEventOrderFromTemplate(eventId, templateId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Use: fixed lines + optional venue-filled selectable groups → finalize (no client). */
export async function useEventOrderTemplateAction(
  eventId: string,
  templateId: string,
  opts?: {
    lineSelections?: TemplateApplySelection[];
    answers?: ChoicesAnswers;
  },
) {
  const result = await useEventOrderTemplate(eventId, templateId, opts);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Send: fixed lines + freeze selectable groups for client portal. */
export async function sendEventOrderTemplateAction(
  eventId: string,
  templateId: string,
  opts?: {
    lineSelections?: TemplateApplySelection[];
    answers?: ChoicesAnswers;
  },
) {
  const result = await sendEventOrderTemplate(eventId, templateId, opts);
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

/**
 * Create New Invoice for an Event Order.
 * Reuses a non-void invoice already linked to this Event Order.
 * Does not create or change a payment plan, and does not touch a booking invoice.
 */
export async function createInvoiceFromEventOrderAction(
  eventOrderId: string, eventId: string, clientId: string,
): Promise<CreateInvoiceResult> {
  const { getInvoicesForEventOrder, createAmendedInvoice } = await import("@/lib/invoices/service");
  const { addToExistingPlan, invoiceToOpenForEventOrder } = await import(
    "@/lib/client-choices/selections-billing"
  );
  const { SELECTIONS_INVOICE_DISPLAY_NAME } = await import("@/lib/invoices/display-name");
  const invoices = await getInvoicesForEventOrder(eventOrderId);
  const draft = invoiceToOpenForEventOrder(invoices, eventOrderId);
  if (draft) {
    revalidateEvent(eventId);
    return { ok: true, invoiceId: draft.id };
  }
  // Sent/paid EO invoice exists → incremental draft for new charges only.
  const plan = addToExistingPlan(invoices, eventOrderId);
  if (plan.kind === "amend") {
    const amended = await createAmendedInvoice(plan.invoiceId);
    if (amended.ok) revalidateEvent(eventId);
    return amended;
  }
  const result = await createInvoice({
    clientId,
    eventId,
    notes: "",
    dueDate: "",
    eventOrderId,
    displayName: SELECTIONS_INVOICE_DISPLAY_NAME,
  });
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/**
 * Invoice new charges: open the EO draft, or create an incremental draft after
 * a sent/paid EO invoice. Never links a booking invoice. Does not create a plan.
 */
export async function addSelectionsToExistingInvoiceAction(
  eventOrderId: string, eventId: string,
): Promise<CreateInvoiceResult> {
  const { getInvoicesForEventOrder, createAmendedInvoice } = await import("@/lib/invoices/service");
  const { addToExistingPlan } = await import("@/lib/client-choices/selections-billing");
  const plan = addToExistingPlan(await getInvoicesForEventOrder(eventOrderId), eventOrderId);
  if (plan.kind === "unavailable") {
    return { ok: false, message: "No Event Order invoice to add new charges to." };
  }
  if (plan.kind === "open") {
    revalidateEvent(eventId);
    return { ok: true, invoiceId: plan.invoiceId };
  }
  const result = await createAmendedInvoice(plan.invoiceId);
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
