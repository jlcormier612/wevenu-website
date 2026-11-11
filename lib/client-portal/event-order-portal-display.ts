/**
 * Couple-facing Event Order money rules.
 * Included lines are operational delivery — never present as chargeable amounts.
 * Additional priced lines may show a reference amount; amount due lives on Payments.
 */

export function isEventOrderPortalLineIncluded(
  line: { isIncluded: boolean | null },
): boolean {
  return line.isIncluded !== false;
}

export function eventOrderPortalLineMoneyLabel(
  line: { isIncluded: boolean | null; unitPrice: number | null; amount: number },
  formatMoney: (n: number) => string,
): string {
  if (isEventOrderPortalLineIncluded(line)) return "Included";
  if (line.unitPrice == null) return "—";
  return formatMoney(line.amount);
}

/** Reference total for additional (non-included) priced lines only. */
export function eventOrderPortalAdditionalReferenceTotal(
  lines: Array<{ isIncluded: boolean | null; unitPrice: number | null; amount: number }>,
): number {
  const total = lines.reduce((sum, line) => {
    if (isEventOrderPortalLineIncluded(line)) return sum;
    if (line.unitPrice == null) return sum;
    return sum + (line.amount ?? 0);
  }, 0);
  return Number(total.toFixed(2));
}
