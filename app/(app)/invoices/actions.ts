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
import { buildInvoiceDocumentEmail } from "@/lib/invoices/invoice-document-email";
import {
  beginOutboundSend,
  dueDateLabelFromContext,
  endOutboundSend,
  DOCUMENT_COPY_SOURCE_TYPE,
  hasSuccessfulPaymentRequestSend,
  loadInvoiceOutboundContext,
  PAYMENT_REQUEST_SOURCE_TYPE,
  type InvoiceOutboundContext,
} from "@/lib/invoices/outbound";
import { buildPaymentRequestEmail } from "@/lib/invoices/payment-request-email";
import { getCurrentVenue } from "@/lib/venue/service";

const PAYMENT_REQUEST_ALREADY_SENT =
  "This payment request was already sent. A new payment request is not available for this invoice.";

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

export type PaymentRequestPreview = {
  recipient: string;
  clientName: string;
  amountDueNow: string;
  dueDate: string | null;
  totalContracted: string;
  paidToDate: string;
  remainingBalance: string;
  venueName: string;
  paymentUrl: string | null;
  subject: string;
  text: string;
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

export async function previewPaymentRequestAction(
  invoiceId: string,
): Promise<
  | { ok: true; preview: PaymentRequestPreview; alreadySent: boolean }
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
    return { ok: false, message: PAYMENT_REQUEST_ALREADY_SENT };
  }
  const loaded = await loadInvoiceOutboundContext(invoiceId, { publish: false });
  if (!loaded.ok) return loaded;
  const email = paymentRequestFromContext(loaded.ctx);
  return { ok: true, preview: email, alreadySent: false };
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
): Promise<{ ok: true; method: "resend" | "mailto"; mailtoUrl?: string } | InvoiceActionResult> {
  if (!beginOutboundSend("payment_request", invoiceId)) {
    return { ok: false, message: "This payment request is already sending." };
  }
  try {
    const venue = await getCurrentVenue();
    if (!venue) return { ok: false, message: "Invoice or venue not found." };
    const { createAdminClient } = await import("@/integrations/supabase/admin");
    const admin = createAdminClient();
    if (await hasSuccessfulPaymentRequestSend(admin, { venueId: venue.id, invoiceId })) {
      return { ok: false, message: PAYMENT_REQUEST_ALREADY_SENT };
    }
    const loaded = await loadInvoiceOutboundContext(invoiceId, { publish: true });
    if (!loaded.ok) return loaded;
    const email = paymentRequestFromContext(loaded.ctx);
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
        console.error("[sendInvoiceEmailAction] conversation record failed", recorded);
      }
      revalidatePath(`/invoices/${invoiceId}`);
      revalidatePath(`/clients/${loaded.ctx.clientId}`);
    }
    return result;
  } finally {
    endOutboundSend("payment_request", invoiceId);
  }
}

export type InvoiceDocumentPreview = {
  recipient: string;
  clientName: string;
  venueName: string;
  subject: string;
  text: string;
  documentsUrl: string | null;
};

export async function previewInvoiceDocumentCopyAction(
  invoiceId: string,
): Promise<{ ok: true; preview: InvoiceDocumentPreview } | InvoiceActionResult> {
  const loaded = await loadInvoiceOutboundContext(invoiceId, {
    publish: false,
    ensureCoupleDocuments: true,
  });
  if (!loaded.ok) return loaded;
  const email = documentCopyFromContext(loaded.ctx);
  return {
    ok: true,
    preview: {
      recipient: loaded.ctx.clientEmail,
      clientName: `${loaded.ctx.clientFirstName} ${loaded.ctx.clientLastName}`.trim(),
      venueName: loaded.ctx.venueName,
      subject: email.subject,
      text: email.text,
      documentsUrl: loaded.ctx.documentsUrl,
    },
  };
}

export async function sendInvoiceDocumentCopyAction(
  invoiceId: string,
): Promise<{ ok: true; method: "resend" | "mailto"; mailtoUrl?: string } | InvoiceActionResult> {
  if (!beginOutboundSend("document_copy", invoiceId)) {
    return { ok: false, message: "This document copy is already sending." };
  }
  try {
    const loaded = await loadInvoiceOutboundContext(invoiceId, {
      publish: true,
      ensureCoupleDocuments: true,
    });
    if (!loaded.ok) return loaded;
    const email = documentCopyFromContext(loaded.ctx);
    const result = await sendEmail({
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: email.replyTo,
    });
    if (result.ok && result.method === "resend") {
      const { createAdminClient } = await import("@/integrations/supabase/admin");
      const { recordExternalClientOutbound } = await import("@/lib/conversations/record-external-outbound");
      const recorded = await recordExternalClientOutbound(createAdminClient(), {
        venueId: loaded.ctx.venueId,
        clientId: loaded.ctx.clientId,
        channel: "email",
        body: email.text,
        providerId: result.providerId ?? null,
        status: "accepted",
        sourceType: DOCUMENT_COPY_SOURCE_TYPE,
        sourceId: invoiceId,
      });
      if (!recorded.ok) {
        console.error("[sendInvoiceDocumentCopyAction] conversation record failed", recorded);
      }
      revalidatePath(`/invoices/${invoiceId}`);
      revalidatePath(`/clients/${loaded.ctx.clientId}`);
    }
    return result;
  } finally {
    endOutboundSend("document_copy", invoiceId);
  }
}

function paymentRequestFromContext(ctx: InvoiceOutboundContext) {
  return buildPaymentRequestEmail({
    clientFirstName: ctx.clientFirstName,
    clientEmail: ctx.clientEmail,
    venueName: ctx.venueName,
    venueEmail: ctx.venueEmail,
    invoiceLabel: ctx.invoiceLabel,
    invoiceNumber: ctx.invoice.invoiceNumber,
    dueNow: ctx.dueNow,
    dueDate: dueDateLabelFromContext(ctx),
    totalContracted: ctx.invoice.total,
    paidToDate: ctx.paidToDate,
    remainingAfter: ctx.remainingAfter,
    balanceDue: ctx.invoice.balanceDue,
    portalPayUrl: ctx.portalPayUrl,
  });
}

function documentCopyFromContext(ctx: InvoiceOutboundContext) {
  return buildInvoiceDocumentEmail({
    clientFirstName: ctx.clientFirstName,
    clientEmail: ctx.clientEmail,
    clientName: `${ctx.clientFirstName} ${ctx.clientLastName}`.trim(),
    venueName: ctx.venueName,
    venueEmail: ctx.venueEmail,
    invoiceLabel: ctx.invoiceLabel,
    invoiceNumber: ctx.invoice.invoiceNumber,
    eventDate: ctx.invoice.eventDate,
    totalContracted: ctx.invoice.total,
    paidToDate: ctx.paidToDate,
    balanceDue: ctx.invoice.balanceDue,
    scheduleLines: ctx.scheduleLines,
    documentsUrl: ctx.documentsUrl,
  });
}
