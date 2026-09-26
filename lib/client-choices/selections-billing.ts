/**
 * Decisions for Client Choices financial impact.
 * Finalize does not call these. Create New Invoice and Add to Existing do.
 */

import { unbilledSelectionsTotal, type UnbilledEventOrderLine } from "@/lib/client-choices/unbilled-delta";
import type { InvoiceStatus } from "@/lib/invoices/types";

export type EoInvoiceRef = {
  id: string;
  status: InvoiceStatus;
  invoiceNumber: string;
  eventOrderId?: string | null;
};

export type SelectionsFinancialImpact = {
  unbilledAmount: number;
  clientId: string | null;
  eventOrderId: string | null;
  /** Non-void invoice already linked to this Event Order. Draft preferred. */
  eoInvoice: { id: string; status: InvoiceStatus; invoiceNumber: string } | null;
};

export function nonVoidEoInvoices<T extends EoInvoiceRef>(invoices: T[], eventOrderId: string): T[] {
  return invoices.filter((inv) => inv.eventOrderId === eventOrderId && inv.status !== "void");
}

/** Open an existing EO invoice instead of inserting another. Draft wins. */
export function invoiceToOpenForEventOrder<T extends EoInvoiceRef>(
  invoices: T[],
  eventOrderId: string,
): T | null {
  const open = nonVoidEoInvoices(invoices, eventOrderId);
  return open.find((inv) => inv.status === "draft") ?? open[0] ?? null;
}

/**
 * Add to Existing is absent unless this Event Order already has its own invoice.
 * Draft: open it (live projection). Sent/paid with no draft yet: amend.
 * An existing draft amendment is opened — a second amendment is not started.
 */
export function addToExistingPlan(
  invoices: EoInvoiceRef[],
  eventOrderId: string,
):
  | { kind: "open"; invoiceId: string }
  | { kind: "amend"; invoiceId: string }
  | { kind: "unavailable" } {
  const open = nonVoidEoInvoices(invoices, eventOrderId);
  if (open.length === 0) return { kind: "unavailable" };
  const draft = open.find((inv) => inv.status === "draft");
  if (draft) return { kind: "open", invoiceId: draft.id };
  const amendable = open.find((inv) => inv.status === "sent" || inv.status === "paid");
  if (amendable) return { kind: "amend", invoiceId: amendable.id };
  return { kind: "unavailable" };
}

export function financialImpactCopy(
  unbilledAmount: number,
  eoInvoice: { status: InvoiceStatus } | null,
): string | null {
  if (!(unbilledAmount > 0)) return null;
  const amount = `$${unbilledAmount.toFixed(2)}`;
  if (!eoInvoice) {
    return `These finalized selections add ${amount}. Nothing has been billed yet.`;
  }
  if (eoInvoice.status === "draft") {
    return "These selections are in draft review on the Event Order invoice.";
  }
  return `These finalized selections add ${amount} that is not on the current invoice yet.`;
}

export function buildSelectionsFinancialImpact(input: {
  eventOrderId: string | null;
  clientId: string | null;
  lines: UnbilledEventOrderLine[];
  invoices: EoInvoiceRef[];
  frozenEventOrderLineIds: Iterable<string>;
}): SelectionsFinancialImpact {
  const eventOrderId = input.eventOrderId;
  const eoInvoice = eventOrderId
    ? invoiceToOpenForEventOrder(input.invoices, eventOrderId)
    : null;
  return {
    unbilledAmount: unbilledSelectionsTotal(input.lines, input.frozenEventOrderLineIds),
    clientId: input.clientId,
    eventOrderId,
    eoInvoice: eoInvoice
      ? { id: eoInvoice.id, status: eoInvoice.status, invoiceNumber: eoInvoice.invoiceNumber }
      : null,
  };
}
