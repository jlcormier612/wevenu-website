/**
 * Human-facing invoice name helpers.
 * invoice_number remains the immutable system identifier.
 */
export function defaultInvoiceDisplayName(input: {
  obligationKind?: string | null;
  scheduleLabel?: string | null;
  packageName?: string | null;
  notes?: string | null;
}): string {
  const label = input.scheduleLabel?.trim();
  if (label) return label;
  if (input.obligationKind === "deposit") return "Wedding Deposit";
  if (input.obligationKind === "final") return "Final Balance";
  const pkg = input.packageName?.trim();
  if (pkg) return pkg;
  return "Invoice";
}

/** Primary human label: prefer display_name, never invent from invoice_number. */
export function invoiceHumanLabel(invoice: {
  displayName?: string | null;
  invoiceNumber: string;
}): string {
  const name = invoice.displayName?.trim();
  if (name) return name;
  return "Invoice";
}

/** Secondary system identity for audit/accounting surfaces. */
export function invoiceSystemNumber(invoice: { invoiceNumber: string }): string {
  return invoice.invoiceNumber;
}
