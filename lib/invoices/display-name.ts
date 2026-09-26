/**
 * Human-facing invoice name helpers.
 * invoice_number remains the immutable system identifier.
 */

/** Display name used only when creating an Event Order selections invoice. */
export const SELECTIONS_INVOICE_DISPLAY_NAME = "Event & Inventory Selections";
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

/**
 * Couple document title. Matches get_couple_documents:
 * prefer display_name; invoice_number is a separate field.
 */
export function coupleDocumentInvoiceName(displayName: string | null | undefined): string {
  const name = displayName?.trim();
  return name || "Invoice";
}

/** Secondary system identity for audit/accounting surfaces. */
export function invoiceSystemNumber(invoice: { invoiceNumber: string }): string {
  return invoice.invoiceNumber;
}
