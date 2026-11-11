/**
 * Reconcile Event Order billable charges with an invoice's payable total.
 *
 * Delivery subtotal on the Event Order (sum of all priced lines, including
 * included/non-billable) is intentionally NOT the invoice payable. Invoice
 * charges follow isBillableEventOrderLineForInvoice, then the same
 * tax/discount/fee rules as computeInvoiceTotals.
 */
import { computeInvoiceTotals } from "@/lib/invoices/constants";
import type { InvoiceLineItemType } from "@/lib/invoices/types";
import {
  isBillableEventOrderLineForInvoice,
  type UnbilledEventOrderLine,
} from "@/lib/client-choices/unbilled-delta";
import { roundMoney } from "@/lib/commercial-selections/constants";

export type ReconciliationLine = {
  type: InvoiceLineItemType;
  amount: number;
};

export type EventOrderInvoiceReconciliation = {
  deliverySubtotal: number;
  billableSubtotal: number;
  includedOrNonBillable: number;
  invoiceAdjustmentsSubtotal: number;
  discountAmount: number;
  taxAmount: number;
  payableTotal: number;
};

/** Sum of every priced Event Order line — informational delivery subtotal only. */
export function eventOrderDeliverySubtotal(
  lines: Array<Pick<UnbilledEventOrderLine, "amount">>,
): number {
  return roundMoney(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));
}

/** Billable commercial charges that may project onto / freeze into an invoice. */
export function eventOrderBillableSubtotal(lines: UnbilledEventOrderLine[]): number {
  return roundMoney(
    lines.reduce((sum, line) => {
      if (!isBillableEventOrderLineForInvoice(line)) return sum;
      return sum + Number(line.amount || 0);
    }, 0),
  );
}

/**
 * Expected invoice payable from EO billable charges plus stored ad hoc invoice
 * lines (tax, discount, fee, etc.). Projected EO charge rows must not be passed
 * in `storedInvoiceLines` — only persisted invoice_line_items.
 */
export function reconcileEventOrderInvoicePayable(input: {
  eventOrderLines: UnbilledEventOrderLine[];
  storedInvoiceLines: ReconciliationLine[];
}): EventOrderInvoiceReconciliation {
  const deliverySubtotal = eventOrderDeliverySubtotal(input.eventOrderLines);
  const billableSubtotal = eventOrderBillableSubtotal(input.eventOrderLines);
  const includedOrNonBillable = roundMoney(deliverySubtotal - billableSubtotal);

  const syntheticBillable: ReconciliationLine[] = input.eventOrderLines
    .filter(isBillableEventOrderLineForInvoice)
    .map((line) => ({ type: "item" as const, amount: Number(line.amount || 0) }));

  const combined = [...syntheticBillable, ...input.storedInvoiceLines];
  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(combined);
  // subtotal here includes billable EO + non-tax/non-discount stored lines (fees).
  const invoiceAdjustmentsSubtotal = roundMoney(subtotal - billableSubtotal);

  return {
    deliverySubtotal,
    billableSubtotal,
    includedOrNonBillable,
    invoiceAdjustmentsSubtotal,
    discountAmount,
    taxAmount,
    payableTotal: total,
  };
}

/** Fail when two money figures disagree beyond normal currency rounding. */
export function moneyFiguresAgree(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= tolerance;
}
