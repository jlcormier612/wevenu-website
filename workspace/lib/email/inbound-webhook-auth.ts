/**
 * Workspace CRM inbound email webhook authentication (Resend / Svix).
 *
 * Fail-closed: missing or empty RESEND_WEBHOOK_SECRET rejects all requests.
 * Auth is Svix HMAC only (svix-id / svix-timestamp / svix-signature).
 * Query-string secrets and unsigned "dev" bypasses are not accepted.
 *
 * Comma-separated secrets support rotation (any listed secret may match).
 * Distinct Resend endpoints issue distinct signing secrets — do not reuse an
 * unrelated endpoint's secret.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_SECONDS = 300;

export type SvixHeaderSource = {
  get(name: string): string | null;
};

export function parseInboundWebhookSecrets(
  raw: string | undefined | null,
): string[] {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return [];
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

function svixSigningKey(secret: string): Buffer {
  if (secret.startsWith("whsec_")) {
    return Buffer.from(secret.slice("whsec_".length), "base64");
  }
  return Buffer.from(secret, "utf8");
}

export function verifyInboundSvixSignature(
  rawBody: string,
  headers: SvixHeaderSource,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const svixId = headers.get("svix-id") ?? "";
  const svixTimestamp = headers.get("svix-timestamp") ?? "";
  const svixSignature = headers.get("svix-signature") ?? "";
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const ts = parseInt(svixTimestamp, 10);
  if (Number.isNaN(ts) || Math.abs(nowSeconds - ts) > MAX_SKEW_SECONDS) {
    return false;
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", svixSigningKey(secret))
    .update(toSign)
    .digest("base64");

  const candidates = svixSignature
    .split(" ")
    .map((part) => part.replace(/^v1,/, "").trim())
    .filter(Boolean);

  return candidates.some((candidate) => {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(candidate);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

/**
 * Authorize a Workspace inbound webhook request.
 * Returns false when configuration is missing or the signature is invalid.
 */
export function authorizeInboundWebhook(
  rawBody: string,
  headers: SvixHeaderSource,
  rawSecretEnv: string | undefined | null = process.env.RESEND_WEBHOOK_SECRET,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const secrets = parseInboundWebhookSecrets(rawSecretEnv);
  if (secrets.length === 0) return false;

  if (
    !(headers.get("svix-id") || headers.get("svix-signature"))
  ) {
    return false;
  }

  return secrets.some((secret) =>
    verifyInboundSvixSignature(rawBody, headers, secret, nowSeconds),
  );
}

/** Build a valid Svix signature header for tests (never log secrets). */
export function signInboundWebhookForTest(
  rawBody: string,
  secret: string,
  opts?: { id?: string; timestamp?: number },
): { id: string; timestamp: string; signature: string } {
  const id = opts?.id ?? "msg_test_inbound";
  const timestamp = String(opts?.timestamp ?? Math.floor(Date.now() / 1000));
  const toSign = `${id}.${timestamp}.${rawBody}`;
  const sig = createHmac("sha256", svixSigningKey(secret))
    .update(toSign)
    .digest("base64");
  return { id, timestamp, signature: `v1,${sig}` };
}
