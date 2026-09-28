/**
 * Payment-request email — next open installment, not the full invoice document.
 */
import { formatCurrency } from "@/lib/invoices/constants";
import type { AmountDueNowResult } from "@/lib/invoices/amount-due-now";

export type PaymentRequestEmailInput = {
  clientFirstName: string;
  clientEmail: string;
  venueName: string;
  venueEmail?: string | null;
  invoiceLabel: string;
  invoiceNumber: string;
  dueNow: AmountDueNowResult;
  dueDate: string | null;
  totalContracted: number;
  paidToDate: number;
  remainingAfter: number;
  balanceDue: number;
  portalPayUrl: string | null;
};

export type PaymentRequestEmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  recipient: string;
  clientName: string;
  amountDueNow: string;
  dueDate: string | null;
  totalContracted: string;
  paidToDate: string;
  remainingBalance: string;
  venueName: string;
  paymentUrl: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPaymentRequestEmail(input: PaymentRequestEmailInput): PaymentRequestEmailContent {
  const amountDueLabel =
    input.dueNow.kind === "next_installment"
      ? input.dueNow.label?.trim()
        || (input.dueNow.obligationKind === "deposit" ? "Deposit" : "Amount due now")
      : input.dueNow.kind === "paid_in_full"
        ? "Paid in full"
        : "Balance remaining";

  const amountDueValue =
    input.dueNow.kind === "next_installment"
      ? formatCurrency(input.dueNow.amount)
      : input.dueNow.kind === "paid_in_full"
        ? formatCurrency(0)
        : formatCurrency(input.balanceDue);

  const remainingLine =
    input.dueNow.kind === "next_installment"
      ? `Remaining after this payment: ${formatCurrency(input.remainingAfter)}`
      : input.balanceDue > 0
        ? `Balance remaining: ${formatCurrency(input.balanceDue)}`
        : "Paid in full.";

  const textLines = [
    `Hi ${input.clientFirstName},`,
    "",
    `${input.venueName} is requesting payment for your ${input.invoiceLabel}.`,
    "",
    `${amountDueLabel}: ${amountDueValue}`,
    input.dueDate ? `Due: ${input.dueDate}` : null,
    "",
    `Total contracted: ${formatCurrency(input.totalContracted)}`,
    `Paid to date: ${formatCurrency(input.paidToDate)}`,
    remainingLine,
    "",
    input.portalPayUrl ? `Pay online: ${input.portalPayUrl}` : null,
    input.portalPayUrl ? "" : null,
    `Reference: ${input.invoiceNumber}`,
    "",
    `Warm regards,`,
    input.venueName,
    input.venueEmail ?? "",
  ].filter((line) => line !== null);

  const html = [
    `<p>Hi ${escapeHtml(input.clientFirstName)},</p>`,
    `<p>${escapeHtml(input.venueName)} is requesting payment for your <strong>${escapeHtml(input.invoiceLabel)}</strong>.</p>`,
    `<p style="font-size:18px;margin:16px 0"><strong>${escapeHtml(amountDueLabel)}: ${escapeHtml(amountDueValue)}</strong></p>`,
    input.dueDate ? `<p>Due: ${escapeHtml(input.dueDate)}</p>` : "",
    `<p>Total contracted: ${escapeHtml(formatCurrency(input.totalContracted))}<br/>`,
    `Paid to date: ${escapeHtml(formatCurrency(input.paidToDate))}<br/>`,
    `${escapeHtml(remainingLine)}</p>`,
    input.portalPayUrl
      ? `<p><a href="${escapeHtml(input.portalPayUrl)}" style="display:inline-block;padding:12px 20px;background:#5D6F5D;color:#fff;text-decoration:none;border-radius:6px">Pay ${escapeHtml(amountDueValue)}</a></p><p style="font-size:12px;color:#666">${escapeHtml(input.portalPayUrl)}</p>`
      : "",
    `<p style="font-size:12px;color:#666">Reference: ${escapeHtml(input.invoiceNumber)}</p>`,
    `<p>Warm regards,<br/>${escapeHtml(input.venueName)}</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    to: input.clientEmail,
    subject: `Your ${input.invoiceLabel} payment request — ${input.venueName}`,
    text: textLines.join("\n"),
    html,
    replyTo: input.venueEmail ?? undefined,
    recipient: input.clientEmail,
    clientName: input.clientFirstName,
    amountDueNow: amountDueValue,
    dueDate: input.dueDate,
    totalContracted: formatCurrency(input.totalContracted),
    paidToDate: formatCurrency(input.paidToDate),
    remainingBalance: remainingLine,
    venueName: input.venueName,
    paymentUrl: input.portalPayUrl,
  };
}
