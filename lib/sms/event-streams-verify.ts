/**
 * Twilio Event Streams webhook signature validation (JSON body).
 *
 * Event Streams POSTs CloudEvents JSON and signs with X-Twilio-Signature.
 * Validation uses the destination URL including the bodySHA256 query param
 * (SHA-256 hex of the raw body), then HMAC-SHA1 of that URL with the
 * subaccount Auth Token — not the SMS form-urlencoded param verifier.
 *
 * https://www.twilio.com/docs/events/webhook-quickstart
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function appendBodySha256(url: string, bodySha256: string): string {
  const hashParam = `bodySHA256=${bodySha256}`;
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("bodySHA256")) {
      parsed.searchParams.set("bodySHA256", bodySha256);
      return parsed.toString();
    }
    const joiner = parsed.search ? "&" : "?";
    return `${url}${joiner}${hashParam}`;
  } catch {
    const joiner = url.includes("?") ? "&" : "?";
    return `${url}${joiner}${hashParam}`;
  }
}

/**
 * Verify an Event Streams webhook.
 * @param destinationUrl Exact public destination URL Twilio was configured with
 *   (may already include query params Twilio appended).
 * @param rawBody Raw request body bytes/string used for SHA-256.
 */
export function verifyTwilioEventStreamsSignature(
  destinationUrl: string,
  rawBody: string | Buffer,
  signatureHeader: string | null,
  authToken: string | null | undefined,
): boolean {
  if (!authToken?.trim()) return false;
  if (!signatureHeader?.trim()) return false;

  const bodyBuf = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const bodySha256 = createHash("sha256").update(bodyBuf).digest("hex");
  const urlForSig = appendBodySha256(destinationUrl, bodySha256);
  const expected = createHmac("sha1", authToken).update(urlForSig, "utf8").digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Optional HTTP Basic Auth check when sink destination embeds credentials. */
export function verifyEventStreamsBasicAuth(
  authorizationHeader: string | null,
  expectedUser: string | null | undefined,
  expectedPassword: string | null | undefined,
): boolean {
  if (!expectedUser?.trim() || !expectedPassword?.trim()) {
    // Basic auth not configured — do not require it.
    return true;
  }
  if (!authorizationHeader?.startsWith("Basic ")) return false;
  const encoded = authorizationHeader.slice("Basic ".length).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  const aUser = Buffer.from(user);
  const bUser = Buffer.from(expectedUser);
  const aPass = Buffer.from(pass);
  const bPass = Buffer.from(expectedPassword);
  if (aUser.length !== bUser.length || aPass.length !== bPass.length) return false;
  return timingSafeEqual(aUser, bUser) && timingSafeEqual(aPass, bPass);
}
