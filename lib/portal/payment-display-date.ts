/**
 * Couple Payments date labels.
 * Due dates are date-only YYYY-MM-DD. paidAt arrives as a full ISO timestamp.
 * Both must format as a calendar date without producing "Invalid Date".
 */

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export function formatPortalPaymentDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(DATE_PREFIX);
  if (!match) return "—";
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
