import { createHmac, timingSafeEqual } from "crypto";

/**
 * Calendly signs webhooks with HMAC-SHA256.
 * Header: `Calendly-Webhook-Signature: t=<unix>,v1=<hex>`
 * Signed payload: `${t}.${rawBody}`
 *
 * @see https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-signatures
 */
export function verifyCalendlySignature(
  signatureHeader: string | null,
  rawBody: string,
  signingKey: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !signingKey) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [k, ...rest] = part.trim().split("=");
      return [k, rest.join("=")];
    }),
  );

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSeconds) {
    return false;
  }

  const expected = createHmac("sha256", signingKey)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Optional shared-secret header when Calendly signing key is not configured. */
export function verifySharedSecretHeader(
  request: Request,
  secret: string | undefined,
): boolean {
  if (!secret?.trim()) return true;
  const header =
    request.headers.get("x-calendly-webhook-secret") ||
    request.headers.get("x-webhook-secret");
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
