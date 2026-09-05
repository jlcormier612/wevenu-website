/** GA4 Measurement ID validation — client-safe, no secrets. */

const GA4_ID_RE = /^G-[A-Z0-9]+$/i;

export function normalizeGa4MeasurementId(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return t;
}

export function isValidGa4MeasurementId(raw: string | null | undefined): boolean {
  const t = normalizeGa4MeasurementId(raw);
  return !!t && GA4_ID_RE.test(t);
}
