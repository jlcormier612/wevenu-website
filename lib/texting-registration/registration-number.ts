/**
 * Pure registration-number display helpers. Safe for Client Components.
 * AES encrypt/decrypt stays in sensitive-field.ts (server-only).
 */

/** Digits only; US EIN displayed as last 4. */
export function registrationNumberLast4(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return digits;
  return digits.slice(-4);
}

export function normalizeRegistrationNumber(raw: string): string {
  return raw.replace(/\D/g, "").trim();
}

/** Never log or return full registration numbers from this helper. */
export function maskRegistrationNumberLast4(last4: string | null | undefined): string {
  if (!last4) return "On file";
  return `••••${last4}`;
}
