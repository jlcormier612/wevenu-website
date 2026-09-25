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
  updateInvoiceDisplayName,
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
  if (result.ok) {
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/payments");
  }
  return result;
}

export async function removeLineItemAction(invoiceId: string, itemId: string): Promise<InvoiceActionResult> {
  const result = await removeLineItem(invoiceId, itemId);
  if (result.ok) {
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/payments");
  }
  return result;
}

export async function updateInvoiceStatusAction(invoiceId: string, status: InvoiceStatus): Promise<InvoiceActionResult> {
  const result = await updateInvoiceStatus(invoiceId, status);
  if (result.ok) revalidatePath(`/invoices/${invoiceId}`);
  return result;
}

/** Presentation-only — never changes invoice_number or payment references. */
export async function updateInvoiceDisplayNameAction(
  invoiceId: string,
  displayName: string,
): Promise<InvoiceActionResult> {
  const result = await updateInvoiceDisplayName(invoiceId, displayName);
  if (result.ok) {
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
  }
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
  const clientId = invoice.clientId;

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
    .eq("id", clientId)
    .maybeSingle<{ email: string | null; first_name: string; last_name: string }>();
  if (!client?.email) return { ok: false, message: "Client has no email address on file." };

  // Amount due NOW = next open schedule installment (not full commitment).
  const { resolveAmountDueNow, pickNextOpenPaymentLine } = await import("@/lib/invoices/amount-due-now");
  const { getPaymentSchedules, getPaymentSchedule } = await import("@/lib/payments/service");
  const schedules = (await getPaymentSchedules()).filter((s) => s.invoiceId === invoiceId);
  let scheduleLines: {
    id: string;
    amount: number;
    dueDate: string | null;
    status: string;
    label?: string;
    obligationKind?: string | null;
    sortOrder?: number;
  }[] | null = null;
  if (schedules.length > 0) {
    const detail = await getPaymentSchedule(schedules[0]!.id);
    scheduleLines = (detail?.lineItems ?? []).map((li) => ({
      id: li.id,
      amount: li.amount,
      dueDate: li.dueDate,
      status: li.status,
      label: li.label ?? undefined,
      obligationKind: li.obligationKind,
      sortOrder: li.sortOrder,
    }));
  }
  if (scheduleLines && scheduleLines.length > 0) {
    const { assertRequestablePaymentPlan } = await import("@/lib/payments/reconcile-commitment");
    const gate = assertRequestablePaymentPlan({
      commitmentTotal: invoiceToSend.total,
      lines: scheduleLines,
    });
    if (!gate.ok) {
      return { ok: false, message: `${gate.title} ${gate.body}` };
    }
  }

  const dueNow = resolveAmountDueNow({
    balanceDue: invoiceToSend.balanceDue,
    scheduleLines,
  });
  const dueNowLine = scheduleLines ? pickNextOpenPaymentLine(scheduleLines) : null;

  // Payment access ≠ portal access.
  // Prefer an existing full (couple) workspace link when the client was already invited.
  // Otherwise create/reuse a financial-only session so payers never land in an unclaimed workspace.
  // Bind the CTA to the specific payment_line_item so Pay $X cannot resolve to another installment.
  const { publicAppOrigin } = await import("@/lib/env");
  const { getPortalSessions, createPortalSession } = await import("@/lib/portal/service");
  let portalPayUrl: string | null = null;
  try {
    const sessions = await getPortalSessions(clientId);
    const coupleSession = sessions.find((s) => s.accessLevel === "couple");
    const financialSession = sessions.find((s) => s.accessLevel === "financial");
    let paySession = coupleSession ?? financialSession ?? null;
    if (!paySession) {
      paySession = await createPortalSession(clientId, "Payment", "financial");
    }
    if (paySession?.accessToken) {
      // Bind CTA to the specific installment so Pay $X cannot resolve to another line.
      const itemQs = dueNowLine?.id ? `?item=${encodeURIComponent(dueNowLine.id)}` : "";
      portalPayUrl =
        paySession.accessLevel === "financial"
          ? `${publicAppOrigin()}/p/${paySession.accessToken}${itemQs}`
          : `${publicAppOrigin()}/p/${paySession.accessToken}${itemQs}#payments`;
    }
  } catch {
    /* email still sends without link */
  }

  const { invoiceHumanLabel } = await import("@/lib/invoices/display-name");
  const invoiceLabel = invoiceHumanLabel({
    displayName: invoiceToSend.displayName,
    invoiceNumber: invoiceToSend.invoiceNumber,
  });

  const amountDueLabel =
    dueNow.kind === "next_installment"
      ? dueNow.label?.trim() ||
        (dueNow.obligationKind === "deposit" ? "Deposit" : "Amount due now")
      : dueNow.kind === "paid_in_full"
        ? "Paid in full"
        : "Balance remaining";

  const amountDueValue =
    dueNow.kind === "next_installment"
      ? formatCurrency(dueNow.amount)
      : dueNow.kind === "paid_in_full"
        ? formatCurrency(0)
        : formatCurrency(invoiceToSend.balanceDue);

  const dueDateStr =
    dueNow.kind === "next_installment" && dueNow.dueDate
      ? new Date(dueNow.dueDate + "T12:00:00").toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : invoiceToSend.dueDate
        ? new Date(invoiceToSend.dueDate + "T12:00:00").toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })
        : null;

  const paidToDate = Math.max(0, invoiceToSend.total - invoiceToSend.balanceDue);
  const remainingAfter =
    dueNow.kind === "next_installment"
      ? Math.max(0, invoiceToSend.balanceDue - dueNow.amount)
      : invoiceToSend.balanceDue;

  const textLines = [
    `Hi ${client.first_name},`,
    "",
    `${venue.name} is requesting payment for your ${invoiceLabel}.`,
    "",
    `${amountDueLabel}: ${amountDueValue}`,
    dueDateStr ? `Due: ${dueDateStr}` : null,
    "",
    `Total contracted: ${formatCurrency(invoiceToSend.total)}`,
    `Paid to date: ${formatCurrency(paidToDate)}`,
    dueNow.kind === "next_installment"
      ? `Remaining after this payment: ${formatCurrency(remainingAfter)}`
      : invoiceToSend.balanceDue > 0
        ? `Balance remaining: ${formatCurrency(invoiceToSend.balanceDue)}`
        : "Paid in full.",
    "",
    portalPayUrl ? `Pay online: ${portalPayUrl}` : null,
    portalPayUrl ? "" : null,
    `Reference: ${invoiceToSend.invoiceNumber}`,
    "",
    `Warm regards,`,
    venue.name,
    venue.email ?? "",
  ].filter((line) => line !== null);

  const text = textLines.join("\n");

  const html = [
    `<p>Hi ${escapeHtml(client.first_name)},</p>`,
    `<p>${escapeHtml(venue.name)} is requesting payment for your <strong>${escapeHtml(invoiceLabel)}</strong>.</p>`,
    `<p style="font-size:18px;margin:16px 0"><strong>${escapeHtml(amountDueLabel)}: ${escapeHtml(amountDueValue)}</strong></p>`,
    dueDateStr ? `<p>Due: ${escapeHtml(dueDateStr)}</p>` : "",
    `<p>Total contracted: ${escapeHtml(formatCurrency(invoiceToSend.total))}<br/>`,
    `Paid to date: ${escapeHtml(formatCurrency(paidToDate))}<br/>`,
    dueNow.kind === "next_installment"
      ? `Remaining after this payment: ${escapeHtml(formatCurrency(remainingAfter))}</p>`
      : invoiceToSend.balanceDue > 0
        ? `Balance remaining: ${escapeHtml(formatCurrency(invoiceToSend.balanceDue))}</p>`
        : `Paid in full.</p>`,
    portalPayUrl
      ? `<p><a href="${escapeHtml(portalPayUrl)}" style="display:inline-block;padding:12px 20px;background:#5D6F5D;color:#fff;text-decoration:none;border-radius:6px">Pay ${escapeHtml(amountDueValue)}</a></p><p style="font-size:12px;color:#666">${escapeHtml(portalPayUrl)}</p>`
      : "",
    `<p style="font-size:12px;color:#666">Reference: ${escapeHtml(invoiceToSend.invoiceNumber)}</p>`,
    `<p>Warm regards,<br/>${escapeHtml(venue.name)}</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  const subject =
    dueNow.kind === "next_installment" && dueNow.obligationKind === "deposit"
      ? `Your ${invoiceLabel} payment request — ${venue.name}`
      : `Your ${invoiceLabel} payment request — ${venue.name}`;

  const result = await sendEmail({
    to: client.email,
    subject,
    text,
    html,
    replyTo: venue.email ?? undefined,
  });

  // Mirror successful Resend delivery into the relationship conversation
  // (same pattern as payment/contract reminders). Mailto/disabled paths do
  // not claim a sent message in conversation history.
  if (result.ok && result.method === "resend") {
    // Service role — same pattern as obligation/reminder engines — so the
    // conversation history write is not blocked by session/RLS edge cases.
    const { createAdminClient } = await import("@/integrations/supabase/admin");
    const { recordExternalClientOutbound } = await import("@/lib/conversations/record-external-outbound");
    const recorded = await recordExternalClientOutbound(createAdminClient(), {
      venueId: venue.id,
      clientId: clientId,
      channel: "email",
      body: text,
      providerId: result.providerId ?? null,
      status: "accepted",
      sourceType: "invoice_email",
      sourceId: invoiceId,
    });
    if (!recorded.ok) {
      console.error("[sendInvoiceEmailAction] conversation record failed", recorded);
    }
    revalidatePath(`/invoices/${invoiceId}`);
    if (clientId) revalidatePath(`/clients/${clientId}`);
  }
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
