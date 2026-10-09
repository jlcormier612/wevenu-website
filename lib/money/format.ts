/**
 * Canonical HTC money display. Whole dollars omit ".00"; cents stay when present.
 * Storage and calculations keep numeric values — this is display only.
 */

export function formatMoneyDisplay(
  amount: number | null | undefined,
  currency = "USD",
): string {
  if (amount == null || !Number.isFinite(amount)) return "";
  const hasCents = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
