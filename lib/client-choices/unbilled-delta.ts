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

/**
 * First-release invoice rule for Event Order / selections:
 * only additional billable commercial lines may become invoice charges.
 * Included, unpriced, and $0 lines stay operational on the Event Order
 * and must not enter draft projection or freeze-on-send.
 */
export function isBillableEventOrderLineForInvoice(
  line: Pick<UnbilledEventOrderLine, "amount" | "unitPrice" | "isIncluded">,
): boolean {
  if (line.isIncluded) return false;
  if (line.unitPrice == null || line.unitPrice <= 0) return false;
  return line.amount > 0;
}

export function unbilledSelectionsTotal(
  lines: UnbilledEventOrderLine[],
  frozenEventOrderLineIds: Iterable<string>,
): number {
  const frozen = frozenEventOrderLineIds instanceof Set
    ? frozenEventOrderLineIds
    : new Set(frozenEventOrderLineIds);
  const total = lines.reduce((sum, line) => {
    if (frozen.has(line.id)) return sum;
    if (!isBillableEventOrderLineForInvoice(line)) return sum;
    return sum + line.amount;
  }, 0);
  return Number(total.toFixed(2));
}
