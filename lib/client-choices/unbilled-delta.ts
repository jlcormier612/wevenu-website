/**
 * Unbilled selections total from persisted Event Order lines.
 * A line is already billed when its id is frozen on a non-void invoice
 * (`invoice_line_items.event_order_line_id`). Included / $0 lines do not count.
 * No billing-status column — this is derived on each read.
 */

export type UnbilledEventOrderLine = {
  id: string;
  amount: number;
  unitPrice: number | null;
  isIncluded: boolean;
};

export function unbilledSelectionsTotal(
  lines: UnbilledEventOrderLine[],
  frozenEventOrderLineIds: Iterable<string>,
): number {
  const frozen = frozenEventOrderLineIds instanceof Set
    ? frozenEventOrderLineIds
    : new Set(frozenEventOrderLineIds);
  const total = lines.reduce((sum, line) => {
    if (frozen.has(line.id)) return sum;
    if (line.isIncluded) return sum;
    if (line.unitPrice == null || line.unitPrice <= 0) return sum;
    if (!(line.amount > 0)) return sum;
    return sum + line.amount;
  }, 0);
  return Number(total.toFixed(2));
}
