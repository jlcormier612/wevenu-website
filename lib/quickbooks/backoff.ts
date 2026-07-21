/**
 * Retry backoff for the QuickBooks sync queue. Deliberately far more
 * forgiving than either existing precedent in this codebase's extremes:
 * automation_executions/scheduled_messages retry never (terminal failed on
 * the first attempt), lib/notifications/engine.ts's reminder-reset retries
 * forever with no backoff. This caps at MAX_ATTEMPTS with real exponential
 * backoff — about a day of retrying a transient failure before giving up.
 */

export const MAX_ATTEMPTS = 8;

const BASE_DELAY_MS = 60_000;           // 1 minute
const MAX_DELAY_MS = 6 * 60 * 60_000;   // 6 hours

/** attempt_count is the count *before* this attempt (0 on the first retry). */
export function computeBackoffMs(attemptCount: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attemptCount, MAX_DELAY_MS);
}

export function computeNextAttemptAt(attemptCount: number): string {
  return new Date(Date.now() + computeBackoffMs(attemptCount)).toISOString();
}
