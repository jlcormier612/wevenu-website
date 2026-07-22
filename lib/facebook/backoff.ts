/** Same shape as lib/quickbooks/backoff.ts — 1 min base, doubling, capped at 6h, 8 attempts (~1 day) before dead-letter. */
export const MAX_ATTEMPTS = 8;

export function computeBackoffMs(attemptCount: number): number {
  return Math.min(60_000 * 2 ** attemptCount, 6 * 60 * 60_000);
}

export function computeNextAttemptAt(attemptCount: number): string {
  return new Date(Date.now() + computeBackoffMs(attemptCount)).toISOString();
}
