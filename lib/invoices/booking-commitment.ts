/**
 * Package booking-commitment invoices are a separate obligation from Event Order billing.
 * They have a package line and no frozen Event Order line id.
 */

export type BookingCommitmentLine = {
  invoiceId: string;
  type: string;
  eventOrderLineId: string | null;
};

export function isPackageBookingCommitmentLines(
  lines: { type: string; eventOrderLineId: string | null }[],
): boolean {
  if (lines.some((line) => line.eventOrderLineId)) return false;
  return lines.some((line) => line.type === "package");
}

export function packageBookingCommitmentInvoiceIds(lines: BookingCommitmentLine[]): string[] {
  const byInvoice = new Map<string, BookingCommitmentLine[]>();
  for (const line of lines) {
    const group = byInvoice.get(line.invoiceId) ?? [];
    group.push(line);
    byInvoice.set(line.invoiceId, group);
  }
  const ids: string[] = [];
  for (const [invoiceId, group] of byInvoice) {
    if (isPackageBookingCommitmentLines(group)) ids.push(invoiceId);
  }
  return ids;
}

/** Frozen provenance on non-void invoices only. Voided freezes do not keep a line billed. */
export function frozenEventOrderLineIds(
  lines: BookingCommitmentLine[],
  nonVoidInvoiceIds: Iterable<string>,
): string[] {
  const allowed = nonVoidInvoiceIds instanceof Set ? nonVoidInvoiceIds : new Set(nonVoidInvoiceIds);
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.eventOrderLineId) continue;
    if (!allowed.has(line.invoiceId)) continue;
    ids.add(line.eventOrderLineId);
  }
  return [...ids];
}
