/**
 * Contracted revenue grain.
 *
 * Each invoice is itself. An Event id attributes that invoice to that Event.
 * A missing Event id stays unattributed. Dates use invoice issue date.
 * Booking dates and import dates are not substitutes.
 */

import { dateInWindow, isoDateOrNull } from "@/lib/reporting/performance-dates";

export type ContractedInvoice = {
  id: string;
  clientId: string;
  eventId: string | null;
  issuedAt: string | null;
  subtotal: number;
  discountAmount: number;
  status: string;
};

export type ContractedAttribution = {
  invoiceId: string;
  clientId: string;
  eventId: string | null;
  issuedOn: string | null;
  amount: number;
  dated: boolean;
};

export function contractedAmount(invoice: Pick<ContractedInvoice, "subtotal" | "discountAmount" | "status">): number {
  if (invoice.status === "void") return 0;
  return Number(invoice.subtotal) - Number(invoice.discountAmount);
}

export function attributeContractedInvoice(invoice: ContractedInvoice): ContractedAttribution | null {
  if (invoice.status === "void") return null;
  const issuedOn = isoDateOrNull(invoice.issuedAt);
  return {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    eventId: invoice.eventId,
    issuedOn,
    amount: contractedAmount(invoice),
    dated: issuedOn != null,
  };
}

export function contractedInWindow(
  invoices: readonly ContractedInvoice[],
  window: { from?: string | null; to?: string | null },
): ContractedAttribution[] {
  const rows: ContractedAttribution[] = [];
  for (const invoice of invoices) {
    const row = attributeContractedInvoice(invoice);
    if (!row) continue;
    if (!dateInWindow(row.issuedOn, window)) continue;
    rows.push(row);
  }
  return rows;
}

export function sumAmounts(rows: readonly { amount: number }[]): number {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

/** One grain per Event. Invoices with no Event each stay their own grain. */
export function contractedGrainCount(rows: readonly ContractedAttribution[]): number {
  const grains = new Set<string>();
  for (const row of rows) grains.add(row.eventId ?? `invoice:${row.invoiceId}`);
  return grains.size;
}

export function totalsByEvent(rows: readonly ContractedAttribution[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!row.eventId) continue;
    totals.set(row.eventId, (totals.get(row.eventId) ?? 0) + row.amount);
  }
  return totals;
}
