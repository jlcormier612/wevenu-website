/**
 * Shared invoice outbound context for payment-request and document-copy emails.
 * Publication (draft → sent) is the existing invoice lifecycle that makes
 * get_portal_payments / get_couple_documents return the schedule.
 */
import { createClient } from "@/integrations/supabase/server";
import { resolveAmountDueNow, pickNextOpenPaymentLine } from "@/lib/invoices/amount-due-now";
import { invoiceHumanLabel } from "@/lib/invoices/display-name";
import { getInvoice, updateInvoiceStatus } from "@/lib/invoices/service";
import type { InvoiceWithLineItems } from "@/lib/invoices/types";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { getCurrentVenue } from "@/lib/venue/service";

export type InvoiceOutboundScheduleLine = {
  id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
  obligationKind?: string | null;
  sortOrder?: number;
};

export type InvoiceOutboundContext = {
  invoice: InvoiceWithLineItems;
  venueId: string;
  venueName: string;
  venueEmail: string | null;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  invoiceLabel: string;
  scheduleLines: InvoiceOutboundScheduleLine[];
  dueNow: ReturnType<typeof resolveAmountDueNow>;
  dueNowLine: InvoiceOutboundScheduleLine | null;
  paidToDate: number;
  remainingAfter: number;
  portalPayUrl: string | null;
  documentsUrl: string | null;
};

const sendingPaymentRequest = new Set<string>();
const sendingDocumentCopy = new Set<string>();

/** Persisted after a successful Resend payment-request send (not document copy). */
export const PAYMENT_REQUEST_SOURCE_TYPE = "invoice_email";
export const DOCUMENT_COPY_SOURCE_TYPE = "invoice_document_copy";

export function beginOutboundSend(kind: "payment_request" | "document_copy", invoiceId: string): boolean {
  const lock = kind === "payment_request" ? sendingPaymentRequest : sendingDocumentCopy;
  if (lock.has(invoiceId)) return false;
  lock.add(invoiceId);
  return true;
}

export function endOutboundSend(kind: "payment_request" | "document_copy", invoiceId: string): void {
  (kind === "payment_request" ? sendingPaymentRequest : sendingDocumentCopy).delete(invoiceId);
}

type AdminLike = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Authoritative persisted signal that this invoice's payment request was
 * successfully sent via Resend. Distinct from invoice.status (shared with
 * document-copy publication) and from in-flight process locks.
 */
export async function hasSuccessfulPaymentRequestSend(
  supabase: AdminLike,
  opts: { venueId: string; invoiceId: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("id")
    .eq("venue_id", opts.venueId)
    .contains("channel_metadata", {
      sourceType: PAYMENT_REQUEST_SOURCE_TYPE,
      sourceId: opts.invoiceId,
    })
    .eq("status", "accepted")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[hasSuccessfulPaymentRequestSend]", error);
    return false;
  }
  return Boolean(data?.id);
}

export async function publishInvoiceForCustomerAccess(invoiceId: string): Promise<
  { ok: true; invoice: InvoiceWithLineItems } | { ok: false; message: string }
> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) return { ok: false, message: "Invoice not found." };
  if (invoice.status !== "draft") return { ok: true, invoice };
  const published = await updateInvoiceStatus(invoiceId, "sent");
  if (!published.ok) return { ok: false, message: published.message ?? "Could not publish this invoice." };
  const refreshed = await getInvoice(invoiceId);
  if (!refreshed) return { ok: false, message: "Invoice not found." };
  return { ok: true, invoice: refreshed };
}

export async function loadInvoiceOutboundContext(
  invoiceId: string,
  opts: {
    publish: boolean;
    /**
     * Full-document delivery uses Client Portal Documents. Create a couple
     * session when missing so documentsUrl is present — independent of the
     * financial payment-link session.
     */
    ensureCoupleDocuments?: boolean;
  },
): Promise<{ ok: true; ctx: InvoiceOutboundContext } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Invoice or venue not found." };

  let invoice = await getInvoice(invoiceId);
  if (!invoice) return { ok: false, message: "Invoice or venue not found." };
  if (!invoice.clientId) return { ok: false, message: "Invoice has no linked client." };
  const clientId = invoice.clientId;

  if (opts.publish) {
    const published = await publishInvoiceForCustomerAccess(invoiceId);
    if (!published.ok) return published;
    invoice = published.invoice;
  }

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients")
    .select("email, first_name, last_name")
    .eq("id", clientId)
    .maybeSingle<{ email: string | null; first_name: string; last_name: string }>();
  if (!client?.email) return { ok: false, message: "Client has no email address on file." };

  const schedules = (await getPaymentSchedules()).filter((s) => s.invoiceId === invoiceId);
  let scheduleLines: InvoiceOutboundScheduleLine[] = [];
  if (schedules.length > 0) {
    const detail = await getPaymentSchedule(schedules[0]!.id);
    scheduleLines = (detail?.lineItems ?? []).map((li) => ({
      id: li.id,
      amount: li.amount,
      dueDate: li.dueDate,
      status: li.status,
      label: li.label,
      obligationKind: li.obligationKind,
      sortOrder: li.sortOrder,
    }));
  }

  if (scheduleLines.length > 0) {
    const { assertRequestablePaymentPlan } = await import("@/lib/payments/reconcile-commitment");
    const gate = assertRequestablePaymentPlan({
      commitmentTotal: invoice.total,
      lines: scheduleLines,
    });
    if (!gate.ok && opts.publish) {
      return { ok: false, message: `${gate.title} ${gate.body}` };
    }
  }

  const { venueToday } = await import("@/lib/venue/timezone");
  const today = venueToday(venue.timezone);
  const dueNow = resolveAmountDueNow({
    balanceDue: invoice.balanceDue,
    scheduleLines,
    today,
  });
  const dueNowLine =
    dueNow.kind === "next_installment" && scheduleLines.length > 0
      ? pickNextOpenPaymentLine(scheduleLines)
      : null;
  const paidToDate = Math.max(0, invoice.total - invoice.balanceDue);
  const remainingAfter =
    dueNow.kind === "next_installment"
      ? Math.max(0, invoice.balanceDue - dueNow.amount)
      : invoice.balanceDue;

  const { publicAppOrigin } = await import("@/lib/env");
  let portalPayUrl: string | null = null;
  let documentsUrl: string | null = null;
  try {
    const { getPortalSessions, createPortalSession } = await import("@/lib/portal/service");
    const sessions = await getPortalSessions(clientId);
    let coupleSession = sessions.find((s) => s.accessLevel === "couple") ?? null;
    let financialSession = sessions.find((s) => s.accessLevel === "financial") ?? null;
    if (opts.ensureCoupleDocuments && !coupleSession) {
      coupleSession = await createPortalSession(clientId, "Documents", "couple");
    }
    // Payment CTA must be a financial-token destination — never couple portal login.
    if (dueNow.kind === "next_installment" && !financialSession) {
      financialSession = await createPortalSession(clientId, "Payment", "financial");
    }
    if (dueNow.kind === "next_installment" && financialSession?.accessToken) {
      const itemQs = dueNowLine?.id ? `?item=${encodeURIComponent(dueNowLine.id)}` : "";
      portalPayUrl = `${publicAppOrigin()}/p/${financialSession.accessToken}${itemQs}`;
    }
    if (coupleSession?.accessToken) {
      documentsUrl = `${publicAppOrigin()}/p/${coupleSession.accessToken}#documents`;
    }
  } catch {
    /* email still sends without link */
  }

  const invoiceLabel = invoiceHumanLabel({
    displayName: invoice.displayName,
    invoiceNumber: invoice.invoiceNumber,
  });

  return {
    ok: true,
    ctx: {
      invoice,
      venueId: venue.id,
      venueName: venue.name,
      venueEmail: venue.email ?? null,
      clientId,
      clientFirstName: client.first_name,
      clientLastName: client.last_name,
      clientEmail: client.email,
      invoiceLabel,
      scheduleLines,
      dueNow,
      dueNowLine,
      paidToDate,
      remainingAfter,
      portalPayUrl,
      documentsUrl,
    },
  };
}

export function dueDateLabelFromContext(ctx: InvoiceOutboundContext): string | null {
  if (ctx.dueNow.kind === "next_installment" && ctx.dueNow.dueDate) {
    return new Date(ctx.dueNow.dueDate + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (ctx.invoice.dueDate) {
    return new Date(ctx.invoice.dueDate + "T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return null;
}
