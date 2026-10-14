/**
 * Classify Resend HTTP failures so quota / rate-limit exhaustion is
 * distinguishable from other provider errors — and so CloudWatch can
 * early-warn before operators only notice silent customer miss.
 *
 * Log marker `ResendProviderLimitSignal` is scraped by the Sandbox metric
 * filter on `/ecs/htc-sandbox/venue-app` → HTC/Sandbox ResendProviderLimitSignalCount.
 */

import {
  classifyResendHttpFailureGuidance,
  type EmailFailureCategory,
} from "@/lib/communication/email-failure-guidance";

/** Legacy / CloudWatch-facing codes (keep stable for metric filters). */
export type ResendFailureCode =
  | "quota"
  | "rate_limit"
  | "invalid_recipient"
  | "configuration"
  | "temporary"
  | "provider";

export type ClassifiedResendFailure = {
  code: ResendFailureCode;
  /** Operator-safe message (no secrets / raw PII). */
  message: string;
  /** True when retrying soon is likely to amplify load without delivering. */
  retryUnsafe: boolean;
  category: EmailFailureCategory;
};

function toResendCode(category: EmailFailureCategory): ResendFailureCode {
  switch (category) {
    case "quota":
      return "quota";
    case "rate_limit":
      return "rate_limit";
    case "invalid_recipient":
      return "invalid_recipient";
    case "configuration":
      return "configuration";
    case "temporary_provider":
      return "temporary";
    default:
      return "provider";
  }
}

export function classifyResendHttpFailure(opts: {
  status: number;
  bodyText: string;
}): ClassifiedResendFailure {
  const g = classifyResendHttpFailureGuidance(opts);
  // Immediate/automatic retry is unsafe for limits; temporary 5xx may be retried later.
  const retryUnsafe =
    g.category === "quota"
    || g.category === "rate_limit"
    || g.category === "invalid_recipient"
    || g.category === "configuration"
    || g.category === "unknown"
    || (g.category === "temporary_provider" ? false : !g.retryAppropriate);
  return {
    code: toResendCode(g.category),
    message: g.explanation,
    retryUnsafe,
    category: g.category,
  };
}

/** Stable token for CloudWatch Logs metric filters — do not rename lightly. */
export const RESEND_PROVIDER_LIMIT_LOG_MARKER = "ResendProviderLimitSignal";

export function formatResendLimitLogLine(code: ResendFailureCode, status: number): string {
  return `${RESEND_PROVIDER_LIMIT_LOG_MARKER} code=${code} status=${status}`;
}
