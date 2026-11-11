/**
 * Lightweight marketing inquiry spam helpers (server + client field contract).
 * Honeypot only — durable rate limiting needs shared infrastructure (see report).
 */

/** Field name bots fill; never shown to visitors. */
export const INQUIRY_HONEYPOT_FIELD = "website_url";

/** True when a bot-like payload filled the honeypot. */
export function isHoneypotTriggered(
  fields: Record<string, string> | null | undefined,
): boolean {
  if (!fields || typeof fields !== "object") return false;
  const value = fields[INQUIRY_HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Strip honeypot + non-string noise before persistence / CRM.
 * Does not mutate the original object.
 */
export function sanitizeInquiryFields(
  fields: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key === INQUIRY_HONEYPOT_FIELD) continue;
    if (typeof value !== "string") continue;
    next[key] = value;
  }
  return next;
}

/** Accept client idempotency keys that look like UUIDs (v4-ish). */
export function normalizeInquiryIdempotencyKey(
  raw: string | null | undefined,
): string | null {
  const value = raw?.trim() ?? "";
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return null;
  }
  return value.toLowerCase();
}
