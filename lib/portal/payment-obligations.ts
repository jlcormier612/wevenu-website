/**
 * Portal payments: one plan per invoice, and a sent invoice with no plan
 * stays its own obligation. Do not collapse distinct invoices to the newest.
 */

import {
  BOOKING_INVOICE_LABEL,
  SELECTIONS_INVOICE_DISPLAY_NAME,
} from "@/lib/invoices/display-name";

export type PortalInvoiceRef = {
  id: string;
  invoiceNumber: string;
  displayName?: string | null;
  total?: number;
  balanceDue?: number;
  status?: string;
  dueDate?: string | null;
};

export type PortalScheduleRef = {
  id: string;
  invoiceId?: string | null;
  title?: string | null;
};

export function portalInvoiceLabel(invoice: {
  displayName?: string | null;
  invoiceNumber?: string | null;
  amendsInvoiceId?: string | null;
}): string {
  const name = invoice.displayName?.trim();
  const number = invoice.invoiceNumber?.trim();
  const amending = Boolean(invoice.amendsInvoiceId);
  if (name === SELECTIONS_INVOICE_DISPLAY_NAME) {
    if (amending && number) return `Additional charges · ${number}`;
    if (number) return `${SELECTIONS_INVOICE_DISPLAY_NAME} · ${number}`;
    return SELECTIONS_INVOICE_DISPLAY_NAME;
  }
  if (name === "Invoice") return BOOKING_INVOICE_LABEL;
  if (name && number && amending) return `${name} · ${number}`;
  if (name) return name;
  if (number) return `Invoice · ${number}`;
  return "Invoice";
}

/** Plain-language next step when an invoice has a balance but no schedule. */
export function bareInvoiceNextStepCopy(balanceDue: number): string {
  if (!(balanceDue > 0)) {
    return "This invoice has no remaining balance.";
  }
  return "No payment schedule was set for this invoice. Pay this balance separately using the method your venue listed above — it is not covered by another invoice’s plan.";
}

export function labelForSchedule(
  schedule: PortalScheduleRef,
  invoices: PortalInvoiceRef[],
): string {
  const invoice = schedule.invoiceId
    ? invoices.find((row) => row.id === schedule.invoiceId)
    : undefined;
  if (invoice) return portalInvoiceLabel(invoice);
  const title = schedule.title?.trim();
  if (title) return title;
  return "Payment plan";
}

/** Sent/paid invoices that have no canonical schedule of their own. */
export function invoicesWithoutPaymentPlan(
  invoices: PortalInvoiceRef[],
  schedules: PortalScheduleRef[],
): PortalInvoiceRef[] {
  const covered = new Set(
    schedules.map((schedule) => schedule.invoiceId).filter((id): id is string => !!id),
  );
  return invoices.filter((invoice) => {
    if (covered.has(invoice.id)) return false;
    if (invoice.status === "draft" || invoice.status === "void") return false;
    return true;
  });
}
