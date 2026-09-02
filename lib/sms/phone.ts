/**
 * Phone number normalization for SMS — venues enter phone numbers in all
 * sorts of formats ("(615) 555-1234", "615.555.1234", "+16155551234"), but
 * Twilio requires E.164 for sending, and matching an inbound "From" number
 * back to a stored lead/client phone needs both sides normalized the same
 * way to compare (2026-07-11).
 */

/** Digits only — the comparison key for matching two phone numbers regardless of formatting. */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Best-effort E.164 conversion, assuming US/Canada when no country code is present. */
export function toE164(phone: string): string | null {
  const digits = phoneDigits(phone);
  if (!digits) return null;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** Venue-facing display of a stored number, using the same E.164 rules as send. */
export function formatPhoneDisplay(phone: string): string {
  const e164 = toE164(phone);
  if (!e164) return phone.trim();
  const digits = phoneDigits(e164);
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}
