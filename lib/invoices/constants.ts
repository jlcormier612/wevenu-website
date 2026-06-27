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
