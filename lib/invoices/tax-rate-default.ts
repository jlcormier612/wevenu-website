/** Editable starting value for a new Tax line — venue default, else blank. */
export function defaultTaxRateInput(defaultTaxPercent: number | null | undefined): string {
  if (defaultTaxPercent == null || !Number.isFinite(defaultTaxPercent)) return "";
  const n = Number(defaultTaxPercent);
  return Number.isInteger(n) ? String(n) : String(n);
}
