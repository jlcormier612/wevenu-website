/**
 * Canonical customer email for Invoice & Payment Plan.
 * One send: schedule + totals + Pay now when an installment is actually due.
 */
import { formatCurrency } from "@/lib/invoices/constants";
import type { AmountDueNowResult } from "@/lib/invoices/amount-due-now";

export type InvoiceAndPaymentPlanScheduleLine = {
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
};

export type InvoiceAndPaymentPlanEmailInput = {
  clientFirstName: string;
  clientEmail: string;
  clientName: string;
  venueName: string;
  venueEmail?: string | null;
  invoiceLabel: string;
  invoiceNumber: string;
  eventDate: string | null;
  eventName?: string | null;
  totalContracted: number;
  paidToDate: number;
  balanceDue: number;
  dueNow: AmountDueNowResult;
  dueDateLabel: string | null;
  remainingAfter: number;
  scheduleLines: InvoiceAndPaymentPlanScheduleLine[];
  /** Direct Stripe-handoff URL (financial token). Never a portal login prerequisite. */
  payUrl: string | null;
  documentsUrl: string | null;
};

export type InvoiceAndPaymentPlanEmailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  recipient: string;
  clientName: string;
  venueName: string;
  amountDueNow: string | null;
  dueDate: string | null;
  totalContracted: string;
  paidToDate: string;
  remainingBalance: string;
  paymentUrl: string | null;
  documentsUrl: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDue(dueDate: string | null): string {
  if (!dueDate) return "Date TBD";
  return new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function payableNow(dueNow: AmountDueNowResult): dueNow is Extract<AmountDueNowResult, { kind: "next_installment" }> {
  return dueNow.kind === "next_installment" && dueNow.amount > 0;
}

export function buildInvoiceAndPaymentPlanEmail(
  input: InvoiceAndPaymentPlanEmailInput,
): InvoiceAndPaymentPlanEmailContent {
  const dueNow = input.dueNow;
  const payNow = payableNow(dueNow);
  const amountDueValue = payNow ? formatCurrency(dueNow.amount) : null;
  const amountDueLabel = payNow
    ? (dueNow.label?.trim() || "Amount due now")
    : null;

  const scheduleText = input.scheduleLines.length > 0
    ? input.scheduleLines
      .map((l) => `• ${l.label}: ${formatCurrency(l.amount)} — due ${formatDue(l.dueDate)}`)
      .join("\n")
    : "No installment schedule is on file.";

  const dueNowText = payNow
    ? [
        `${amountDueLabel}: ${amountDueValue}`,
        input.dueDateLabel ? `Due: ${input.dueDateLabel}` : null,
        `Remaining after this payment: ${formatCurrency(input.remainingAfter)}`,
        "",
      ]
    : dueNow.kind === "scheduled_future"
      ? [
          `Next payment (${dueNow.label ?? "installment"}): ${formatCurrency(dueNow.amount)} due ${formatDue(dueNow.dueDate)}. It is not due yet.`,
          "",
        ]
      : [""];

  const eventLine = input.eventName && input.eventDate
    ? `Event: ${input.eventName} — ${formatDue(input.eventDate)}`
    : input.eventDate
      ? `Event: ${formatDue(input.eventDate)}`
      : input.eventName
        ? `Event: ${input.eventName}`
        : null;

  const text = [
    `Hi ${input.clientFirstName},`,
    "",
    `${input.venueName} has sent your invoice and payment plan.`,
    "",
    `Client: ${input.clientName}`,
    eventLine,
    `Invoice: ${input.invoiceLabel} (${input.invoiceNumber})`,
    `Total contracted: ${formatCurrency(input.totalContracted)}`,
    `Paid to date: ${formatCurrency(input.paidToDate)}`,
    `Balance remaining: ${formatCurrency(input.balanceDue)}`,
    "",
    ...dueNowText,
    "Payment plan",
    scheduleText,
    "",
    payNow && input.payUrl ? `Pay now: ${input.payUrl}` : null,
    input.documentsUrl ? `View your documents: ${input.documentsUrl}` : null,
    "",
    `Warm regards,`,
    input.venueName,
    input.venueEmail ?? "",
  ].filter((line) => line !== null).join("\n");

  const scheduleHtml = input.scheduleLines.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <th align="left" style="padding:8px 0;border-bottom:1px solid #ddd">Payment</th>
          <th align="left" style="padding:8px 0;border-bottom:1px solid #ddd">Due</th>
          <th align="right" style="padding:8px 0;border-bottom:1px solid #ddd">Amount</th>
        </tr>
        ${input.scheduleLines.map((l) =>
          `<tr><td style="padding:8px 0">${escapeHtml(l.label)}</td><td style="padding:8px 0">${escapeHtml(formatDue(l.dueDate))}</td><td align="right" style="padding:8px 0">${escapeHtml(formatCurrency(l.amount))}</td></tr>`
        ).join("")}
      </table>`
    : "<p>No installment schedule is on file.</p>";

  const payButton = payNow && input.payUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(input.payUrl)}" style="display:inline-block;padding:14px 24px;background:#5D6F5D;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Pay ${escapeHtml(amountDueValue ?? "")} now</a></p>`
    : "";

  const documentsLink = input.documentsUrl
    ? `<p style="font-size:13px;color:#666"><a href="${escapeHtml(input.documentsUrl)}" style="color:#5D6F5D">View your documents</a></p>`
    : "";

  const dueNowHtml = payNow
    ? `<p style="font-size:20px;margin:16px 0 4px"><strong>${escapeHtml(amountDueLabel ?? "Amount due now")}: ${escapeHtml(amountDueValue ?? "")}</strong></p>
       ${input.dueDateLabel ? `<p>Due ${escapeHtml(input.dueDateLabel)}</p>` : ""}
       <p>Remaining after this payment: ${escapeHtml(formatCurrency(input.remainingAfter))}</p>`
    : dueNow.kind === "scheduled_future"
      ? `<p>Next payment (${escapeHtml(dueNow.label ?? "installment")}): ${escapeHtml(formatCurrency(dueNow.amount))} due ${escapeHtml(formatDue(dueNow.dueDate))}. It is not due yet.</p>`
      : "";

  const html = [
    `<p>Hi ${escapeHtml(input.clientFirstName)},</p>`,
    `<p>${escapeHtml(input.venueName)} has sent your invoice and payment plan.</p>`,
    `<p>Client: ${escapeHtml(input.clientName)}<br/>`,
    eventLine ? `${escapeHtml(eventLine)}<br/>` : "",
    `Invoice: ${escapeHtml(input.invoiceLabel)} (${escapeHtml(input.invoiceNumber)})<br/>`,
    `Total contracted: ${escapeHtml(formatCurrency(input.totalContracted))}<br/>`,
    `Paid to date: ${escapeHtml(formatCurrency(input.paidToDate))}<br/>`,
    `Balance remaining: ${escapeHtml(formatCurrency(input.balanceDue))}</p>`,
    dueNowHtml,
    payButton,
    `<p style="margin-top:24px"><strong>Payment plan</strong></p>`,
    scheduleHtml,
    documentsLink,
    `<p>Warm regards,<br/>${escapeHtml(input.venueName)}</p>`,
  ].filter(Boolean).join("\n");

  return {
    to: input.clientEmail,
    subject: `Your invoice and payment plan — ${input.venueName}`,
    text,
    html,
    replyTo: input.venueEmail ?? undefined,
    recipient: input.clientEmail,
    clientName: input.clientName,
    venueName: input.venueName,
    amountDueNow: amountDueValue,
    dueDate: input.dueDateLabel,
    totalContracted: formatCurrency(input.totalContracted),
    paidToDate: formatCurrency(input.paidToDate),
    remainingBalance: formatCurrency(input.balanceDue),
    paymentUrl: payNow ? input.payUrl : null,
    documentsUrl: input.documentsUrl,
  };
}
