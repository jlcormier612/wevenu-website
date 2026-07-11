/**
 * Twilio webhook signature verification (2026-07-11).
 *
 * Twilio's scheme (distinct from Resend/Svix's HMAC-SHA256 used elsewhere in
 * this codebase — see app/api/messaging/webhook/route.ts): HMAC-SHA1 of the
 * exact webhook URL Twilio was configured to call, with every POST param
 * (sorted by key, no delimiter) appended directly to it, keyed by the
 * account's Auth Token. https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return true; // Skip verification when not configured (dev/unset)
  if (!signatureHeader) return false;

  const data = Object.keys(params).sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
