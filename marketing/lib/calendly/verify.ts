import { createHmac, timingSafeEqual } from "crypto";

/**
 * Calendly signs webhooks with HMAC-SHA256.
 * Header: `Calendly-Webhook-Signature: t=<unix>,v1=<hex>`
 * Signed payload: `${t}.${rawBody}`
 *
 * Replay protection: reject when |now - t| exceeds toleranceSeconds (default 300).
 *
 * @see https://developer.calendly.com/api-docs/ZG9jOjM2MzE2MDM4-webhook-signatures
 */
export function verifyCalendlySignature(
  signatureHeader: string | null,
  rawBody: string,
  signingKey: string,
  /** Calendly docs use a 3-minute (180s) example tolerance zone. */
  toleranceSeconds = 180,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!signatureHeader?.trim() || !signingKey.trim()) return false;

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
  if (Math.abs(nowSeconds - ts) > toleranceSeconds) {
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

/**
 * Optional shared-secret header fallback when Calendly signing key is not used.
 * Fail closed: missing/empty configured secret or missing/mismatched header → false.
 */
export function verifySharedSecretHeader(
  request: Request,
  secret: string | undefined | null,
): boolean {
  const expected = secret?.trim() || "";
  if (!expected) return false;
  const header =
    request.headers.get("x-calendly-webhook-secret") ||
    request.headers.get("x-webhook-secret");
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
