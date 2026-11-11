import {
  verifyCalendlySignature,
  verifySharedSecretHeader,
} from "@/lib/calendly/verify";

export type CalendlyWebhookAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Fail closed unless Calendly signing key or shared secret is configured
 * and the request authenticates. Never accept unsigned webhooks.
 *
 * Prefer CALENDLY_WEBHOOK_SIGNING_KEY (Calendly-Webhook-Signature HMAC).
 * Optional fallback: CALENDLY_WEBHOOK_SHARED_SECRET + x-calendly-webhook-secret.
 */
export function assertCalendlyWebhookAuth(input: {
  signingKey: string | undefined | null;
  sharedSecret: string | undefined | null;
  signatureHeader: string | null;
  rawBody: string;
  request: Request;
  /** Injected for stale-signature tests; defaults to wall clock. */
  nowSeconds?: number;
  toleranceSeconds?: number;
}): CalendlyWebhookAuthResult {
  const signingKey = input.signingKey?.trim() || "";
  const sharedSecret = input.sharedSecret?.trim() || "";

  if (!signingKey && !sharedSecret) {
    return {
      ok: false,
      status: 503,
      error: "Webhook not configured.",
    };
  }

  if (signingKey) {
    if (
      !verifyCalendlySignature(
        input.signatureHeader,
        input.rawBody,
        signingKey,
        input.toleranceSeconds ?? 180,
        input.nowSeconds ?? Math.floor(Date.now() / 1000),
      )
    ) {
      return { ok: false, status: 401, error: "Invalid signature." };
    }
    return { ok: true };
  }

  if (!verifySharedSecretHeader(input.request, sharedSecret)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid or missing webhook secret.",
    };
  }
  return { ok: true };
}
