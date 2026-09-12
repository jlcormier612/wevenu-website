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
  "No priced delivery items are on this Event Order yet. That is fine for menus and included items — continue if $0 is intentional. Clients will see prices only where you set them; amount due always lives on Payments.";
