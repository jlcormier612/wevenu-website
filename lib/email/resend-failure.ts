/**
 * Classify Resend HTTP failures so quota / rate-limit exhaustion is
 * distinguishable from transient provider errors — and so CloudWatch can
 * early-warn before operators only notice silent customer miss.
 *
 * Log marker `ResendProviderLimitSignal` is scraped by the Sandbox metric
 * filter on `/ecs/htc-sandbox/venue-app` → HTC/Sandbox ResendProviderLimitSignalCount.
 */

export type ResendFailureCode = "quota" | "rate_limit" | "provider";

export type ClassifiedResendFailure = {
  code: ResendFailureCode;
  /** Operator-safe message (no secrets / raw PII). */
  message: string;
  /** True when retrying soon is likely to amplify load without delivering. */
  retryUnsafe: boolean;
};

export function classifyResendHttpFailure(opts: {
  status: number;
  bodyText: string;
}): ClassifiedResendFailure {
  const body = (opts.bodyText || "").toLowerCase();
  const status = opts.status;

  const quotaHint =
    body.includes("quota") ||
    body.includes("monthly limit") ||
    body.includes("daily limit") ||
    body.includes("usage limit") ||
    (body.includes("exceeded") && body.includes("limit"));

  if (status === 429 || body.includes("rate_limit") || body.includes("too many requests")) {
    // Resend sometimes returns 429 for both rate and quota; prefer quota when named.
    if (quotaHint && !body.includes("rate")) {
      return {
        code: "quota",
        message: "Email provider daily/monthly sending limit reached. Message was not delivered.",
        retryUnsafe: true,
      };
    }
    return {
      code: "rate_limit",
      message: "Email provider rate limit reached. Message was not delivered.",
      retryUnsafe: true,
    };
  }

  if (status === 402 || quotaHint) {
    return {
      code: "quota",
      message: "Email provider sending quota exhausted. Message was not delivered.",
      retryUnsafe: true,
    };
  }

  return {
    code: "provider",
    message: "Email send failed due to a provider error.",
    retryUnsafe: status >= 500,
  };
}

/** Stable token for CloudWatch Logs metric filters — do not rename lightly. */
export const RESEND_PROVIDER_LIMIT_LOG_MARKER = "ResendProviderLimitSignal";

export function formatResendLimitLogLine(code: ResendFailureCode, status: number): string {
  return `${RESEND_PROVIDER_LIMIT_LOG_MARKER} code=${code} status=${status}`;
}
