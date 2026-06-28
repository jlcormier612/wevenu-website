"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import {
  addLineItem,
  createInvoice,
  getInvoice,
  removeLineItem,
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

  // Fetch client email
  const { data: client } = await supabase.from("clients")
    .select("email, first_name, last_name")
    .eq("id", invoice.clientId)
    .maybeSingle<{ email: string | null; first_name: string; last_name: string }>();
  if (!client?.email) return { ok: false, message: "Client has no email address on file." };

  // Build plain text email
  const dueStr = invoice.dueDate
    ? new Date(invoice.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const lineItemsText = invoice.lineItems
    .filter((i) => i.type !== "discount" && i.type !== "deposit")
    .map((i) => `  ${i.description}: ${formatCurrency(i.amount)}`)
    .join("\n");

  const discountsText = invoice.lineItems
    .filter((i) => i.type === "discount" || i.type === "deposit")
    .map((i) => `  ${i.description}: -${formatCurrency(i.amount)}`)
    .join("\n");

  const text = [
    `Hi ${client.first_name},`,
    "",
    `Please find your invoice from ${venue.name} below.`,
    "",
    `Invoice: ${invoice.invoiceNumber}`,
    dueStr ? `Due: ${dueStr}` : null,
    "",
    lineItemsText || null,
    discountsText ? `\nDiscounts / deposits:\n${discountsText}` : null,
    invoice.taxAmount > 0 ? `\nTax: ${formatCurrency(invoice.taxAmount)}` : null,
    "",
    `Total: ${formatCurrency(invoice.total)}`,
    invoice.balanceDue > 0 ? `Balance due: ${formatCurrency(invoice.balanceDue)}` : "Paid in full.",
    invoice.notes ? `\nNotes: ${invoice.notes}` : null,
    "",
    `Please don't hesitate to reach out with any questions.`,
    "",
    `Warm regards,`,
    venue.name,
    venue.email ?? "",
  ].filter(Boolean).join("\n");

  const result = await sendEmail({
    to: client.email,
    subject: `Invoice ${invoice.invoiceNumber} from ${venue.name}`,
    text,
    replyTo: venue.email ?? undefined,
  });

  if (result.ok && result.method === "resend") {
    revalidatePath(`/invoices/${invoiceId}`);
  }
  return result;
}
