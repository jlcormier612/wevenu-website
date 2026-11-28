/**
 * In-process throttle for public wedding-website password attempts.
 * Complements server-side hash verification; not a substitute for WAF.
 */
type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const buckets = new Map<string, Bucket>();

export function allowWeddingWebsitePasswordAttempt(key: string, now = Date.now()): boolean {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (existing.count >= MAX_ATTEMPTS) return false;
  existing.count += 1;
  return true;
}

/** Test helper — clears in-memory buckets. */
export function resetWeddingWebsitePasswordAttemptsForTests(): void {
  buckets.clear();
}
