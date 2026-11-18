/**
 * Bounded retry policy for notification email delivery (task_reminders +
 * venue_notifications). Complements Resend classification in
 * lib/email/resend-failure.ts — that module marks retryUnsafe; this module
 * decides terminal vs deferred retry with backoff.
 *
 * Shape mirrors lib/quickbooks/backoff.ts / lib/facebook/backoff.ts so we do
 * not introduce a second queue system.
 */

import type { ResendFailureCode } from "@/lib/email/resend-failure";
import { parseRetryAfterSeconds } from "@/lib/email/retry-after";

export { parseRetryAfterSeconds };

export const EMAIL_DELIVERY_MAX_ATTEMPTS = 8;
/** Short lease so a second cron tick does not double-send the same row. */
export const EMAIL_DELIVERY_LEASE_MS = 120_000;

const BASE_DELAY_MS = 60_000; // 1 minute
const MAX_DELAY_MS = 6 * 60 * 60_000; // 6 hours
/** Quota resets are daily-ish — defer longer than short rate limits. */
const QUOTA_MIN_DELAY_MS = 60 * 60_000; // 1 hour

export type DeliveryFailureCode =
  | ResendFailureCode
  | "disabled"
  | "misconfigured"
  | "unknown";

export type DeliveryDisposition =
  | {
      kind: "terminal";
      attemptCount: number;
      code: DeliveryFailureCode;
      message: string;
    }
  | {
      kind: "defer";
      attemptCount: number;
      nextAttemptAt: string;
      code: DeliveryFailureCode;
      message: string;
      delayMs: number;
    };

/** attemptCount = failures already recorded before applying this failure. */
export function computeEmailDeliveryBackoffMs(
  attemptCount: number,
  opts?: {
    code?: DeliveryFailureCode | null;
    retryAfterSeconds?: number | null;
    /** Deterministic tests: pass 0 to disable jitter. Default: random 0–20%. */
    jitterRatio?: number;
  },
): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attemptCount), MAX_DELAY_MS);
  let delay = exp;
  if (opts?.code === "quota") {
    delay = Math.max(delay, QUOTA_MIN_DELAY_MS);
  }
  if (opts?.retryAfterSeconds != null && opts.retryAfterSeconds > 0) {
    delay = Math.max(delay, opts.retryAfterSeconds * 1000);
  }
  const jitterRatio =
    opts?.jitterRatio != null
      ? Math.max(0, Math.min(opts.jitterRatio, 0.5))
      : Math.random() * 0.2;
  return Math.min(Math.floor(delay * (1 + jitterRatio)), MAX_DELAY_MS);
}

export function computeEmailDeliveryNextAttemptAt(
  attemptCount: number,
  opts?: {
    code?: DeliveryFailureCode | null;
    retryAfterSeconds?: number | null;
    jitterRatio?: number;
    nowMs?: number;
  },
): { nextAttemptAt: string; delayMs: number } {
  const delayMs = computeEmailDeliveryBackoffMs(attemptCount, opts);
  const nowMs = opts?.nowMs ?? Date.now();
  return {
    delayMs,
    nextAttemptAt: new Date(nowMs + delayMs).toISOString(),
  };
}

export function isTerminalDeliveryCode(code: DeliveryFailureCode | null | undefined): boolean {
  return (
    code === "invalid_recipient"
    || code === "configuration"
    || code === "disabled"
    || code === "misconfigured"
  );
}

/**
 * Decide terminal vs deferred after a failed send attempt.
 * attemptCountBefore = rows.attempt_count prior to this failure (0 on first fail).
 */
export function resolveDeliveryDisposition(opts: {
  code?: DeliveryFailureCode | null;
  message: string;
  attemptCountBefore: number;
  retryAfterSeconds?: number | null;
  jitterRatio?: number;
  nowMs?: number;
  maxAttempts?: number;
}): DeliveryDisposition {
  const code: DeliveryFailureCode = opts.code ?? "unknown";
  const attemptCount = opts.attemptCountBefore + 1;
  const maxAttempts = opts.maxAttempts ?? EMAIL_DELIVERY_MAX_ATTEMPTS;
  const message = opts.message;

  if (isTerminalDeliveryCode(code)) {
    return { kind: "terminal", attemptCount, code, message };
  }

  if (attemptCount >= maxAttempts) {
    return {
      kind: "terminal",
      attemptCount,
      code,
      message: `${message} (delivery retries exhausted after ${attemptCount} attempts)`,
    };
  }

  const { nextAttemptAt, delayMs } = computeEmailDeliveryNextAttemptAt(opts.attemptCountBefore, {
    code,
    retryAfterSeconds: opts.retryAfterSeconds,
    jitterRatio: opts.jitterRatio,
    nowMs: opts.nowMs,
  });

  return {
    kind: "defer",
    attemptCount,
    nextAttemptAt,
    code,
    message,
    delayMs,
  };
}

export function emailDeliveryLeaseUntil(nowMs = Date.now()): string {
  return new Date(nowMs + EMAIL_DELIVERY_LEASE_MS).toISOString();
}

/** Thrown from notification send paths so catch blocks retain classification. */
export class EmailDeliveryFailure extends Error {
  readonly code: DeliveryFailureCode;
  readonly retryAfterSeconds?: number;
  readonly retryUnsafe?: boolean;

  constructor(opts: {
    message: string;
    code?: DeliveryFailureCode | null;
    retryAfterSeconds?: number;
    retryUnsafe?: boolean;
  }) {
    super(opts.message);
    this.name = "EmailDeliveryFailure";
    this.code = opts.code ?? "unknown";
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.retryUnsafe = opts.retryUnsafe;
  }
}

export function deliveryFailureFromUnknown(err: unknown): {
  message: string;
  code: DeliveryFailureCode;
  retryAfterSeconds?: number;
} {
  if (err instanceof EmailDeliveryFailure) {
    return {
      message: err.message,
      code: err.code,
      retryAfterSeconds: err.retryAfterSeconds,
    };
  }
  return {
    message: err instanceof Error ? err.message : String(err),
    code: "unknown",
  };
}

export function reminderFailureUpdate(disposition: DeliveryDisposition): Record<string, unknown> {
  if (disposition.kind === "terminal") {
    return {
      status: "failed",
      attempt_count: disposition.attemptCount,
      last_error_code: disposition.code,
      last_error_message: disposition.message.slice(0, 500),
      next_attempt_at: new Date().toISOString(),
    };
  }
  return {
    status: "pending",
    attempt_count: disposition.attemptCount,
    next_attempt_at: disposition.nextAttemptAt,
    last_error_code: disposition.code,
    last_error_message: disposition.message.slice(0, 500),
  };
}

/**
 * Terminal email: clear needs_email without setting emailed_at so we never
 * claim the message was delivered.
 */
export function venueNotificationFailureUpdate(
  disposition: DeliveryDisposition,
): Record<string, unknown> {
  if (disposition.kind === "terminal") {
    return {
      needs_email: false,
      email_attempt_count: disposition.attemptCount,
      email_last_error_code: disposition.code,
      email_last_error_message: disposition.message.slice(0, 500),
      email_next_attempt_at: null,
    };
  }
  return {
    email_attempt_count: disposition.attemptCount,
    email_next_attempt_at: disposition.nextAttemptAt,
    email_last_error_code: disposition.code,
    email_last_error_message: disposition.message.slice(0, 500),
  };
}
