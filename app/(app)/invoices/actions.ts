"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import {
  addLineItem,
  createAmendedInvoice,
  createInvoice,
  dismissEventOrderDrift,
  removeLineItem,
  revertInvoiceToDraft,
  updateInvoiceDisplayName,
  updateInvoiceStatus,
} from "@/lib/invoices/service";
import type {
  AddLineItemResult,
  CreateInvoiceResult,
  InvoiceActionResult,
  InvoiceInput,
  InvoiceLineItemInput,
  InvoiceStatus,
} from "@/lib/invoices/types";
import { sendEmail } from "@/lib/email/send";
import { emailBrandFromVenue } from "@/lib/email/venue-brand";
import { buildInvoiceAndPaymentPlanEmail } from "@/lib/invoices/invoice-and-payment-plan-email";
import {
  beginOutboundSend,
  dueDateLabelFromContext,
  endOutboundSend,
  hasSuccessfulPaymentRequestSend,
  loadInvoiceOutboundContext,
  PAYMENT_REQUEST_SOURCE_TYPE,
  type InvoiceOutboundContext,
} from "@/lib/invoices/outbound";
import { getCurrentVenue } from "@/lib/venue/service";
import type { EmailVenueBrand } from "@/lib/email/venue-brand";

const INVOICE_ALREADY_SENT =
  "This invoice and payment plan was already sent."

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

export type InvoiceAndPaymentPlanPreview = {
  recipient: string;
  clientName: string;
  venueName: string;
  subject: string;
  amountDueNow: string | null;
  dueDate: string | null;
  totalContracted: string;
  paidToDate: string;
  remainingBalance: string;
  invoicePlanUrl: string | null;
  payableNow: boolean;
};

export async function paymentRequestAlreadySentAction(
  invoiceId: string,
): Promise<{ ok: true; alreadySent: boolean } | InvoiceActionResult> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Invoice or venue not found." };
  const { createAdminClient } = await import("@/integrations/supabase/admin");
  const alreadySent = await hasSuccessfulPaymentRequestSend(createAdminClient(), {
    venueId: venue.id,
    invoiceId,
  });
  return { ok: true, alreadySent };
}

function emailFromContext(ctx: InvoiceOutboundContext, brand: EmailVenueBrand) {
  return buildInvoiceAndPaymentPlanEmail({
    clientFirstName: ctx.clientFirstName,
    clientEmail: ctx.clientEmail,
    clientName: `${ctx.clientFirstName} ${ctx.clientLastName}`.trim(),
    venueName: ctx.venueName,
    venueEmail: ctx.venueEmail,
    invoiceLabel: ctx.invoiceLabel,
    invoiceNumber: ctx.invoice.invoiceNumber,
    eventDate: ctx.invoice.eventDate,
    eventName: ctx.invoice.eventName,
    totalContracted: ctx.invoice.total,
    paidToDate: ctx.paidToDate,
    balanceDue: ctx.invoice.balanceDue,
    dueNow: ctx.dueNow,
    dueDateLabel: dueDateLabelFromContext(ctx),
    remainingAfter: ctx.remainingAfter,
    scheduleLines: ctx.scheduleLines,
    invoicePlanUrl: ctx.invoicePlanUrl,
    brand,
  });
}

function previewFromEmail(
  ctx: InvoiceOutboundContext,
  email: ReturnType<typeof buildInvoiceAndPaymentPlanEmail>,
): InvoiceAndPaymentPlanPreview {
  return {
    recipient: email.recipient,
    clientName: email.clientName,
    venueName: email.venueName,
    subject: email.subject,
    amountDueNow: email.amountDueNow,
    dueDate: email.dueDate,
    totalContracted: email.totalContracted,
    paidToDate: email.paidToDate,
    remainingBalance: email.remainingBalance,
    invoicePlanUrl: email.invoicePlanUrl,
    payableNow: ctx.dueNow.kind === "next_installment",
  };
}

export async function previewInvoiceAndPaymentPlanAction(
  invoiceId: string,
): Promise<
  | { ok: true; preview: InvoiceAndPaymentPlanPreview; alreadySent: boolean }
  | InvoiceActionResult
> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Invoice or venue not found." };
  const { createAdminClient } = await import("@/integrations/supabase/admin");
  const alreadySent = await hasSuccessfulPaymentRequestSend(createAdminClient(), {
    venueId: venue.id,
    invoiceId,
  });
  if (alreadySent) {
    return { ok: false, message: INVOICE_ALREADY_SENT };
  }
  const loaded = await loadInvoiceOutboundContext(invoiceId, {
    publish: false,
  });
  if (!loaded.ok) return loaded;
  const email = emailFromContext(loaded.ctx, emailBrandFromVenue(venue));
  return { ok: true, preview: previewFromEmail(loaded.ctx, email), alreadySent: false };
}

export async function sendInvoiceAndPaymentPlanAction(
  invoiceId: string,
): Promise<{ ok: true; method: "resend" | "mailto"; mailtoUrl?: string } | InvoiceActionResult> {
  if (!beginOutboundSend("payment_request", invoiceId)) {
    return { ok: false, message: "This invoice and payment plan is already sending." };
  }
  try {
    const venue = await getCurrentVenue();
    if (!venue) return { ok: false, message: "Invoice or venue not found." };
    const { createAdminClient } = await import("@/integrations/supabase/admin");
    const admin = createAdminClient();
    if (await hasSuccessfulPaymentRequestSend(admin, { venueId: venue.id, invoiceId })) {
      return { ok: false, message: INVOICE_ALREADY_SENT };
    }
    const loaded = await loadInvoiceOutboundContext(invoiceId, {
      publish: true,
    });
    if (!loaded.ok) return loaded;
    const email = emailFromContext(loaded.ctx, emailBrandFromVenue(venue));
    const result = await sendEmail({
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: email.replyTo,
    });
    if (result.ok && result.method === "resend") {
      const { recordExternalClientOutbound } = await import("@/lib/conversations/record-external-outbound");
      const recorded = await recordExternalClientOutbound(admin, {
        venueId: loaded.ctx.venueId,
        clientId: loaded.ctx.clientId,
        channel: "email",
        body: email.text,
        providerId: result.providerId ?? null,
        status: "accepted",
        sourceType: PAYMENT_REQUEST_SOURCE_TYPE,
        sourceId: invoiceId,
      });
      if (!recorded.ok) {
        console.error("[sendInvoiceAndPaymentPlanAction] conversation record failed", recorded);
      }
      revalidatePath(`/invoices/${invoiceId}`);
      revalidatePath(`/clients/${loaded.ctx.clientId}`);
      revalidatePath("/payments");
      revalidatePath("/documents");
    }
    return result;
  } finally {
    endOutboundSend("payment_request", invoiceId);
  }
}

/** @deprecated Canonical send is sendInvoiceAndPaymentPlanAction. */
export async function sendInvoiceEmailAction(
  invoiceId: string,
): Promise<{ ok: true; method: "resend" | "mailto"; mailtoUrl?: string } | InvoiceActionResult> {
  return sendInvoiceAndPaymentPlanAction(invoiceId);
}

/** @deprecated Canonical send is sendInvoiceAndPaymentPlanAction. */
export async function sendInvoiceDocumentCopyAction(
  invoiceId: string,
): Promise<{ ok: true; method: "resend" | "mailto"; mailtoUrl?: string } | InvoiceActionResult> {
  return sendInvoiceAndPaymentPlanAction(invoiceId);
}

/** @deprecated Canonical preview is previewInvoiceAndPaymentPlanAction. */
export async function previewPaymentRequestAction(
  invoiceId: string,
): Promise<
  | { ok: true; preview: InvoiceAndPaymentPlanPreview; alreadySent: boolean }
  | InvoiceActionResult
> {
  return previewInvoiceAndPaymentPlanAction(invoiceId);
}

/** @deprecated Canonical preview is previewInvoiceAndPaymentPlanAction. */
export async function previewInvoiceDocumentCopyAction(
  invoiceId: string,
): Promise<{ ok: true; preview: InvoiceAndPaymentPlanPreview } | InvoiceActionResult> {
  const result = await previewInvoiceAndPaymentPlanAction(invoiceId);
  if (!result.ok) return result;
  if (!("preview" in result)) {
    return { ok: false, message: "Could not prepare this invoice and payment plan." };
  }
  return { ok: true, preview: result.preview };
}
