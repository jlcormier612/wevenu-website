/**
 * Request bounding for the QuickBooks API client.
 *
 * Without a timeout a hung socket blocks a sweep indefinitely, which is what
 * made "maximum legitimate processing time" unbounded and left the queue
 * unable to reason about whether a worker was alive.
 *
 * The harder half of the problem is that a timeout is not a failure: when a
 * POST to Intuit times out we do not know whether Intuit processed it. A read
 * can be retried freely because it has no side effect, but replaying a write
 * can create a second Customer, Invoice, Payment or RefundReceipt. Each sync
 * module does query QuickBooks for a deterministic key before creating, which
 * usually lets a later attempt adopt an orphan rather than duplicate it, but
 * QBO's query endpoint is not guaranteed to be read-your-writes consistent, so
 * that lookup reduces the risk rather than removing it.
 *
 * Writes whose outcome is unknown are therefore reported as uncertain and held
 * for review instead of retried. Reads keep the existing retry semantics.
 */

/**
 * Per-HTTP-request budget, not per item or per sweep. Intuit's API responds
 * well inside this; the value exists to bound a hung connection, and sits far
 * below the 15-minute claim lease so an in-flight request cannot be mistaken
 * for an abandoned claim.
 */
export const QUICKBOOKS_REQUEST_TIMEOUT_MS = 15_000;

/** A request with no method, or GET, cannot change anything in QuickBooks. */
export function isMutatingRequest(init?: { method?: string }): boolean {
  const method = (init?.method ?? "GET").toUpperCase();
  return method !== "GET" && method !== "HEAD";
}

export type TransportFailure = {
  error: string;
  retryable: boolean;
  /** True when Intuit may have applied the request despite the failure. */
  uncertain: boolean;
};

export function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * Classifies a transport-level failure — a timeout or a dropped connection,
 * as distinct from an HTTP response carrying a status code.
 */
export function classifyTransportFailure(input: {
  mutating: boolean;
  err: unknown;
  timeoutMs?: number;
}): TransportFailure {
  const timedOut = isTimeoutError(input.err);
  const detail = timedOut
    ? `timed out after ${input.timeoutMs ?? QUICKBOOKS_REQUEST_TIMEOUT_MS}ms`
    : input.err instanceof Error
      ? input.err.message
      : "connection failed";

  if (input.mutating) {
    // Not retryable on its own account: the processor holds it for review
    // rather than risking a second financial record.
    return {
      error: `QuickBooks write outcome unknown — ${detail}. Held for review to avoid a duplicate record.`,
      retryable: false,
      uncertain: true,
    };
  }
  return { error: `QuickBooks request failed — ${detail}.`, retryable: true, uncertain: false };
}
