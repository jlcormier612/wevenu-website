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
}): string {
  const name = invoice.displayName?.trim();
  if (name === SELECTIONS_INVOICE_DISPLAY_NAME) return SELECTIONS_INVOICE_DISPLAY_NAME;
  if (name === "Invoice") return BOOKING_INVOICE_LABEL;
  if (name) return name;
  return "Invoice";
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
