"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import {
  addLineItem,
  createAmendedInvoice,
  createInvoice,
  dismissEventOrderDrift,
  getInvoice,
  removeLineItem,
  revertInvoiceToDraft,
  updateInvoiceStatus,
} from "@/lib/invoices/service";
import { formatCurrency } from "@/lib/invoices/constants";
import type {
  AddLineItemResult,
  CreateInvoiceResult,
  InvoiceActionResult,
  InvoiceInput,
  InvoiceLineItemInput,
  InvoiceStatus,
} from "@/lib/invoices/types";
import { sendEmail } from "@/lib/email/send";
import { getCurrentVenue } from "@/lib/venue/service";

export async function createInvoiceAction(input: InvoiceInput): Promise<CreateInvoiceResult> {
  const result = await createInvoice(input);
  if (result.ok) { revalidatePath("/invoices"); revalidatePath(`/clients/${input.clientId}`); }
  return result;
}

export async function addLineItemAction(invoiceId: string, input: InvoiceLineItemInput): Promise<AddLineItemResult> {
  const result = await addLineItem(invoiceId, input);
  if (result.ok) revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

export async function removeLineItemAction(invoiceId: string, itemId: string): Promise<InvoiceActionResult> {
  const result = await removeLineItem(invoiceId, itemId);
  if (result.ok) revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

export async function updateInvoiceStatusAction(invoiceId: string, status: InvoiceStatus): Promise<InvoiceActionResult> {
  const result = await updateInvoiceStatus(invoiceId, status);
  if (result.ok) revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

/** Booking Financial Architecture Phase 3b — "Dismiss for now" on the drift banner. */
export async function dismissEventOrderDriftAction(invoiceId: string): Promise<InvoiceActionResult> {
  const result = await dismissEventOrderDrift(invoiceId);
  if (result.ok) revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

/** Booking Financial Architecture Phase 3c — "Update Draft Invoice" on the drift banner. */
export async function revertInvoiceToDraftAction(invoiceId: string): Promise<InvoiceActionResult> {
  const result = await revertInvoiceToDraft(invoiceId);
  if (result.ok) revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

/** Booking Financial Architecture Phase 3c — "Create Amended Invoice" on the drift banner. */
export async function createAmendedInvoiceAction(originalInvoiceId: string): Promise<CreateInvoiceResult> {
  const result = await createAmendedInvoice(originalInvoiceId);
  if (result.ok) { revalidatePath(`/invoices/${originalInvoiceId}`); revalidatePath(`/invoices/${result.invoiceId}`); revalidatePath("/invoices"); }
  return result;
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
): Promise<{ ok: true; method: "resend" | "mailto"; mailtoUrl?: string } | InvoiceActionResult> {
  const [invoice, venue, supabase] = await Promise.all([
    getInvoice(invoiceId),
    getCurrentVenue(),
    createClient(),
  ]);
  if (!invoice || !venue) return { ok: false, message: "Invoice or venue not found." };
  if (!invoice.clientId) return { ok: false, message: "Invoice has no linked client." };

  // Booking Financial Architecture Phase 3b: emailing is another way content
  // leaves the building, not just "Mark as Sent" — an Event-Order-linked
  // Draft invoice needs the same freeze-on-send commitment moment before
  // anything goes out, so a subsequent Event Order change has a real,
  // frozen "as sent" state to be compared against. Scoped to the
  // Event-Order-linked case only — a plain draft invoice keeps its existing
  // behavior of being emailable without a status change.
  let invoiceToSend = invoice;
  if (invoice.status === "draft" && invoice.eventOrderId) {
    const freezeResult = await updateInvoiceStatus(invoiceId, "sent");
    if (!freezeResult.ok) return { ok: false, message: freezeResult.message ?? "Could not prepare this invoice to send." };
    const refreshed = await getInvoice(invoiceId);
    if (!refreshed) return { ok: false, message: "Invoice not found." };
    invoiceToSend = refreshed;
  }

  // Fetch client email
  const { data: client } = await supabase.from("clients")
    .select("email, first_name, last_name")
    .eq("id", invoiceToSend.clientId)
    .maybeSingle<{ email: string | null; first_name: string; last_name: string }>();
  if (!client?.email) return { ok: false, message: "Client has no email address on file." };

  // Build plain text email
  const dueStr = invoiceToSend.dueDate
    ? new Date(invoiceToSend.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const lineItemsText = invoiceToSend.lineItems
    .filter((i) => i.type !== "discount" && i.type !== "deposit")
    .map((i) => `  ${i.description}: ${formatCurrency(i.amount)}`)
    .join("\n");

  const discountsText = invoiceToSend.lineItems
    .filter((i) => i.type === "discount" || i.type === "deposit")
    .map((i) => `  ${i.description}: -${formatCurrency(i.amount)}`)
    .join("\n");

  const text = [
    `Hi ${client.first_name},`,
    "",
    `Please find your invoice from ${venue.name} below.`,
    "",
    `Invoice: ${invoiceToSend.invoiceNumber}`,
    dueStr ? `Due: ${dueStr}` : null,
    "",
    lineItemsText || null,
    discountsText ? `\nDiscounts / deposits:\n${discountsText}` : null,
    invoiceToSend.taxAmount > 0 ? `\nTax: ${formatCurrency(invoiceToSend.taxAmount)}` : null,
    "",
    `Total: ${formatCurrency(invoiceToSend.total)}`,
    invoiceToSend.balanceDue > 0 ? `Balance due: ${formatCurrency(invoiceToSend.balanceDue)}` : "Paid in full.",
    invoiceToSend.notes ? `\nNotes: ${invoiceToSend.notes}` : null,
    "",
    `Please don't hesitate to reach out with any questions.`,
    "",
    `Warm regards,`,
    venue.name,
    venue.email ?? "",
  ].filter(Boolean).join("\n");

  const result = await sendEmail({
    to: client.email,
    subject: `Invoice ${invoiceToSend.invoiceNumber} from ${venue.name}`,
    text,
    replyTo: venue.email ?? undefined,
  });

  if (result.ok && result.method === "resend") {
    revalidatePath(`/invoices/${invoiceId}`);
  }
  return result;
}
