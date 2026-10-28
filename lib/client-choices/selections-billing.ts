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
  /** Present when another invoice was created for new charges after this one. */
  amendedByInvoiceId?: string | null;
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

/**
 * Reuse only an existing EO *draft* (live unbilled projection).
 * Sent/paid invoices are frozen history — never open them to “add” charges.
 */
export function invoiceToOpenForEventOrder<T extends EoInvoiceRef>(
  invoices: T[],
  eventOrderId: string,
): T | null {
  const open = nonVoidEoInvoices(invoices, eventOrderId);
  return open.find((inv) => inv.status === "draft") ?? null;
}

/**
 * Invoice new charges: open an EO draft, or create an incremental draft that
 * amends a sent/paid EO invoice. Never rewrites the original.
 * Prefer amending the tip of the chain (no child amendment yet).
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
  const amendable = open.find(
    (inv) =>
      (inv.status === "sent" || inv.status === "paid") && !inv.amendedByInvoiceId,
  );
  if (amendable) return { kind: "amend", invoiceId: amendable.id };
  // List rows may omit amendedBy — fall back to newest sent/paid.
  const sentOrPaid = open.find((inv) => inv.status === "sent" || inv.status === "paid");
  if (sentOrPaid) return { kind: "amend", invoiceId: sentOrPaid.id };
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
    return `These selections add ${amount} on the draft Event Order invoice (new charges only — already invoiced lines stay off this draft).`;
  }
  return `These finalized selections add ${amount} in new charges that are not on a sent invoice yet. Invoice new charges to bill only those lines; the original invoice stays unchanged.`;
}

export function buildSelectionsFinancialImpact(input: {
  eventOrderId: string | null;
  clientId: string | null;
  lines: UnbilledEventOrderLine[];
  invoices: EoInvoiceRef[];
  frozenEventOrderLineIds: Iterable<string>;
}): SelectionsFinancialImpact {
  const eventOrderId = input.eventOrderId;
  const open = eventOrderId ? nonVoidEoInvoices(input.invoices, eventOrderId) : [];
  const draft = open.find((inv) => inv.status === "draft") ?? null;
  const sentOrPaid =
    open.find((inv) => inv.status === "sent" || inv.status === "paid") ?? null;
  // Copy + CTA: draft for live projection, else any sent/paid EO invoice.
  // Opening a sent invoice still goes through addToExistingPlan (amend), not edit-in-place.
  const eoInvoice = draft ?? sentOrPaid;
  return {
    unbilledAmount: unbilledSelectionsTotal(input.lines, input.frozenEventOrderLineIds),
    clientId: input.clientId,
    eventOrderId,
    eoInvoice: eoInvoice
      ? { id: eoInvoice.id, status: eoInvoice.status, invoiceNumber: eoInvoice.invoiceNumber }
      : null,
  };
}
