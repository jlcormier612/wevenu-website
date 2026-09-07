/**
 * Twilio webhook signature verification.
 *
 * HMAC-SHA1 of the exact webhook URL + sorted POST params, keyed by the
 * subaccount Auth Token (not the API key). Pass authToken from the venue
 * secret resolved via AccountSid — do not rely on a global parent token
 * for customer subaccount webhooks.
 *
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
  authToken: string | null | undefined,
): boolean {
  if (!authToken?.trim()) return false;
  if (!signatureHeader) return false;

  const data = Object.keys(params).sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
