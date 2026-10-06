/**
 * Full payment-plan / invoice document email — not a first-payment request.
 */
import { formatCurrency } from "@/lib/invoices/constants";
import {
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type EmailVenueBrand,
} from "@/lib/email/venue-brand";

export type InvoiceDocumentScheduleLine = {
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
};

export type InvoiceDocumentEmailInput = {
  clientFirstName: string;
  clientEmail: string;
  clientName: string;
  venueName: string;
  venueEmail?: string | null;
  invoiceLabel: string;
  invoiceNumber: string;
  eventDate: string | null;
  totalContracted: number;
  paidToDate: number;
  balanceDue: number;
  scheduleLines: InvoiceDocumentScheduleLine[];
  documentsUrl: string | null;
  brand?: EmailVenueBrand;
};

export type InvoiceDocumentEmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "Date TBD";
  return new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function buildInvoiceDocumentEmail(input: InvoiceDocumentEmailInput): InvoiceDocumentEmailContent {
  const scheduleText = input.scheduleLines.length > 0
    ? input.scheduleLines
      .map((l) => `• ${l.label}: ${formatCurrency(l.amount)} — due ${formatDue(l.dueDate)} (${l.status.replace(/_/g, " ")})`)
      .join("\n")
    : "No installment schedule is on file.";

  const text = [
    `Hi ${input.clientFirstName},`,
    "",
    `${input.venueName} has shared your payment plan and invoice.`,
    "",
    `Client: ${input.clientName}`,
    input.eventDate ? `Event: ${formatDue(input.eventDate)}` : null,
    `Invoice: ${input.invoiceLabel} (${input.invoiceNumber})`,
    `Total contracted: ${formatCurrency(input.totalContracted)}`,
    `Paid to date: ${formatCurrency(input.paidToDate)}`,
    `Balance remaining: ${formatCurrency(input.balanceDue)}`,
    "",
    "Payment plan",
    scheduleText,
    "",
    input.documentsUrl ? `View in your documents: ${input.documentsUrl}` : null,
    "",
    "This is a copy of your invoice and payment plan. It is not a request to pay a specific installment.",
    "",
    `Warm regards,`,
    input.venueName,
    input.venueEmail ?? "",
  ].filter((line) => line !== null).join("\n");

  const scheduleHtml = input.scheduleLines.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><th align="left">Installment</th><th align="left">Due</th><th align="right">Amount</th></tr>
        ${input.scheduleLines.map((l) =>
          `<tr><td>${escapeHtml(l.label)}</td><td>${escapeHtml(formatDue(l.dueDate))}</td><td align="right">${escapeHtml(formatCurrency(l.amount))}</td></tr>`
        ).join("")}
      </table>`
    : "<p>No installment schedule is on file.</p>";

  const brand = input.brand ?? emailBrandFromVenue({
    name: input.venueName,
    email: input.venueEmail,
  });
  const inner = [
    `<p>Hi ${escapeHtml(input.clientFirstName)},</p>`,
    `<p>${escapeHtml(input.venueName)} has shared your payment plan and invoice.</p>`,
    `<p>Client: ${escapeHtml(input.clientName)}<br/>`,
    input.eventDate ? `Event: ${escapeHtml(formatDue(input.eventDate))}<br/>` : "",
    `Invoice: ${escapeHtml(input.invoiceLabel)} (${escapeHtml(input.invoiceNumber)})<br/>`,
    `Total contracted: ${escapeHtml(formatCurrency(input.totalContracted))}<br/>`,
    `Paid to date: ${escapeHtml(formatCurrency(input.paidToDate))}<br/>`,
    `Balance remaining: ${escapeHtml(formatCurrency(input.balanceDue))}</p>`,
    `<p><strong>Payment plan</strong></p>`,
    scheduleHtml,
    input.documentsUrl
      ? `<p><a href="${escapeHtml(input.documentsUrl)}">View in your documents</a></p>`
      : "",
    `<p style="font-size:12px;color:#666">This is a copy of your invoice and payment plan. It is not a request to pay a specific installment.</p>`,
    `<p>Warm regards,<br/>${escapeHtml(input.venueName)}</p>`,
  ].filter(Boolean).join("\n");

  return {
    to: input.clientEmail,
    subject: `Your payment plan and invoice — ${input.venueName}`,
    text,
    html: renderBrandedEmailHtml(brand, inner),
    replyTo: input.venueEmail ?? undefined,
  };
}
