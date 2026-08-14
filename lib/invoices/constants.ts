import type { InvoiceLineItemType, InvoiceStatus } from "@/lib/invoices/types";

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string; description: string }[] = [
  { value: "draft", label: "Draft",  description: "Not yet sent to client" },
  { value: "sent",  label: "Sent",   description: "Delivered to client" },
  { value: "paid",  label: "Paid",   description: "Fully paid" },
  { value: "void",  label: "Void",   description: "Cancelled / superseded" },
];

export const LINE_ITEM_TYPES: { value: InvoiceLineItemType; label: string }[] = [
  { value: "package",   label: "Package" },
  { value: "item",      label: "Line Item" },
  { value: "addon",     label: "Add-On" },
  { value: "fee",       label: "Fee" },
  { value: "discount",  label: "Discount" },
  { value: "tax",       label: "Tax" },
  { value: "deposit",   label: "Deposit Received" },
  { value: "inventory", label: "Inventory / Rental" },
];

/**
 * Work Package D5B — the canonical Metric Registry's 11 Revenue Categories
 * (supabase/migrations/20261221000000_canonical_metrics_foundation.sql)
 * were backfilled onto existing rows exactly once, at migration time, by a
 * one-off SQL `UPDATE ... WHERE revenue_category IS NULL`. Confirmed live
 * (a real transactional INSERT test): nothing in the write path ever
 * populated this column going forward — every invoice_line_item created
 * since that migration shipped (including every line D5A's Event
 * Inventory → Event Order handoff produces) has silently carried
 * `revenue_category = NULL` ever since. This is that same mapping,
 * ported to TypeScript verbatim and applied at the two real write paths
 * (lib/invoices/repository.ts addLineItem / insertFrozenLinesFromEventOrder)
 * — not a new formula, not a new category, the existing one actually
 * reaching new rows. 'addon'/'item' (the generic default) still carry no
 * reliable signal and map to 'Other', exactly as the original backfill's
 * own comment already documented — a real, pre-existing, honestly-labeled
 * limitation, not something this fix invents or hides.
 */
export function deriveRevenueCategory(
  type: InvoiceLineItemType, packageCategory?: string | null,
): string {
  switch (type) {
    case "tax": return "Taxes";
    case "discount": return "Discounts";
    // A 'deposit'-typed line reduces the invoice total the same way a
    // discount does (see computeInvoiceTotals below) — mapped consistently
    // with that existing behavior, not because a deposit is conceptually a discount.
    case "deposit": return "Discounts";
    case "inventory": return "Inventory";
    case "fee": return "Service Charges";
    case "package": {
      const c = (packageCategory ?? "").toLowerCase();
      if (c.includes("venue")) return "Venue Rental";
      if (c.includes("cater") || c.includes("food")) return "Food & Beverage";
      if (c.includes("bar") || c.includes("alcohol")) return "Alcohol";
      return "Packages";
    }
    default: return "Other"; // 'addon' | 'item' — no reliable signal, same as the original backfill
  }
}

export function invoiceStatusLabel(status: InvoiceStatus): string {
  return INVOICE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function lineItemTypeLabel(type: InvoiceLineItemType): string {
  return LINE_ITEM_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function generateInvoiceNumber(invoiceId: string): string {
  const year = new Date().getFullYear();
  const suffix = invoiceId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `INV-${year}-${suffix}`;
}

export function computeInvoiceTotals(lineItems: { type: InvoiceLineItemType; amount: number }[]): {
  subtotal: number; discountAmount: number; taxAmount: number; total: number;
} {
  let subtotal = 0, discountAmount = 0, taxAmount = 0;
  for (const item of lineItems) {
    if (item.type === "discount" || item.type === "deposit") discountAmount += Math.abs(item.amount);
    else if (item.type === "tax") taxAmount += item.amount;
    else subtotal += item.amount;
  }
  return { subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
}
