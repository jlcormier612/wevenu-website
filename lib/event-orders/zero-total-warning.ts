/**
 * Pure helpers for Event Order zero-total commitment warning.
 * Approved readiness docs: disclose (warn), do not hard-block.
 * $0 line items remain allowed; this only decides when to disclose before
 * finalize/share when the running total is exactly $0.00 and lines exist.
 */
export function eventOrderRequiresZeroTotalWarning(total: number, lineCount?: number): boolean {
  if (total !== 0) return false;
  if (lineCount !== undefined) return lineCount > 0;
  return true;
}

export const EVENT_ORDER_ZERO_TOTAL_WARNING =
  "This Event Order currently totals $0.00. If pricing is still incomplete, Cancel and add Package or Inventory lines first. Complimentary or unpriced items are allowed — continue only if $0.00 is intentional. Clients will see this total if you share it.";
