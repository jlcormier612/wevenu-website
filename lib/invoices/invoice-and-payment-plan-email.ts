/**
 * Canonical customer email for Invoice & Payment Plan.
 *
 * One primary CTA: View Invoice & Payment Plan → financial-token page.
 * Payment (Pay $X Now) lives on that page, not as a competing email CTA.
 * Does not link into the normal couple portal / Documents.
 */
import { formatCurrency } from "@/lib/invoices/constants";
import type { AmountDueNowResult } from "@/lib/invoices/amount-due-now";
import {
  brandButtonHtml,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type EmailVenueBrand,
} from "@/lib/email/venue-brand";

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
  /**
   * Direct pre-portal Invoice & Payment Plan page (financial access token).
   * Never a normal couple-portal / Documents URL.
   */
  invoicePlanUrl: string | null;
  brand?: EmailVenueBrand;
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
  /** Same as invoicePlanUrl — customer-facing financial page. */
  invoicePlanUrl: string | null;
  /** @deprecated Prefer invoicePlanUrl; kept null (no email pay CTA). */
  paymentUrl: string | null;
  /** @deprecated Couple Documents are not used for this send. */
  documentsUrl: string | null;
};

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

  const dueNowText = payNow
    ? [
        `${amountDueLabel}: ${amountDueValue}`,
        input.dueDateLabel ? `Due ${input.dueDateLabel}` : null,
        "",
      ]
    : dueNow.kind === "scheduled_future"
      ? [
          `Next payment (${dueNow.label ?? "installment"}): ${formatCurrency(dueNow.amount)} due ${formatDue(dueNow.dueDate)}. It is not due yet.`,
          "",
        ]
      : [""];

  const planUrl = input.invoicePlanUrl;

  const text = [
    `Hi ${input.clientFirstName},`,
    "",
    `${input.venueName} has sent your invoice and payment plan.`,
    "",
    planUrl ? `View Invoice & Payment Plan:` : null,
    planUrl,
    planUrl ? "" : null,
    ...dueNowText,
    `Invoice: ${input.invoiceLabel} (${input.invoiceNumber})`,
    `Total contracted: ${formatCurrency(input.totalContracted)}`,
    `Paid to date: ${formatCurrency(input.paidToDate)}`,
    `Balance remaining: ${formatCurrency(input.balanceDue)}`,
    "",
    `Warm regards,`,
    input.venueName,
    input.venueEmail ?? "",
  ].filter((line) => line !== null).join("\n");

  const brand: EmailVenueBrand =
    input.brand ?? emailBrandFromVenue({ name: input.venueName, email: input.venueEmail });

  const dueNowHtml = payNow
    ? `<p style="margin:0 0 4px;font-size:15px;color:#374151"><strong>${escapeHtml(amountDueLabel ?? "Amount due now")}: ${escapeHtml(amountDueValue ?? "")}</strong></p>
       ${input.dueDateLabel ? `<p style="margin:0 0 16px;font-size:15px;color:#374151">Due ${escapeHtml(input.dueDateLabel)}</p>` : `<p style="margin:0 0 16px"></p>`}`
    : dueNow.kind === "scheduled_future"
      ? `<p style="margin:0 0 16px;font-size:15px;color:#374151">Next payment (${escapeHtml(dueNow.label ?? "installment")}): ${escapeHtml(formatCurrency(dueNow.amount))} due ${escapeHtml(formatDue(dueNow.dueDate))}. It is not due yet.</p>`
      : "";

  const ctaHtml = planUrl
    ? `<p style="margin:0 0 20px">${brandButtonHtml(brand, planUrl, "View Invoice & Payment Plan")}</p>`
    : "";

  const body = [
    `<p style="margin:0 0 12px;font-size:15px;color:#374151">Hi ${escapeHtml(input.clientFirstName)},</p>`,
    `<p style="margin:0 0 20px;font-size:15px;color:#374151"><strong>${escapeHtml(input.venueName)}</strong> has sent your invoice and payment plan.</p>`,
    ctaHtml,
    dueNowHtml,
    `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">Invoice: ${escapeHtml(input.invoiceLabel)} (${escapeHtml(input.invoiceNumber)})</p>`,
    `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">Total contracted: ${escapeHtml(formatCurrency(input.totalContracted))}</p>`,
    `<p style="margin:0 0 4px;font-size:13px;color:#6b7280">Paid to date: ${escapeHtml(formatCurrency(input.paidToDate))}</p>`,
    `<p style="margin:0 0 20px;font-size:13px;color:#6b7280">Balance remaining: ${escapeHtml(formatCurrency(input.balanceDue))}</p>`,
    `<p style="margin:0;font-size:15px;color:#374151">Warm regards,<br/>${escapeHtml(input.venueName)}</p>`,
  ].filter(Boolean).join("");

  return {
    to: input.clientEmail,
    subject: `Your invoice and payment plan — ${input.venueName}`,
    text,
    html: renderBrandedEmailHtml(brand, body),
    replyTo: input.venueEmail ?? undefined,
    recipient: input.clientEmail,
    clientName: input.clientName,
    venueName: input.venueName,
    amountDueNow: amountDueValue,
    dueDate: input.dueDateLabel,
    totalContracted: formatCurrency(input.totalContracted),
    paidToDate: formatCurrency(input.paidToDate),
    remainingBalance: formatCurrency(input.balanceDue),
    invoicePlanUrl: planUrl,
    paymentUrl: null,
    documentsUrl: null,
  };
}
