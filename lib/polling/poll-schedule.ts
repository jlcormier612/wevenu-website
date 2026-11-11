/**
 * Cadence maths for the app's background pollers.
 *
 * During the 2026-09-28 Sandbox incident every open tab polled on a fixed 60s
 * interval and discarded failures, so while Supabase Auth was returning 503 /
 * 429 the offered load never decayed and every tab retried in lockstep. These
 * helpers decay the cadence while a dependency is failing and spread retries
 * so tabs stop arriving together.
 */

/** Steady-state cadence shared by the notification bells. */
export const DEFAULT_POLL_MS = 60_000;

/** Ceiling for a failing poller, so a broken tab still recovers on its own. */
export const DEFAULT_MAX_POLL_MS = 10 * 60_000;

export function nextPollDelayMs({
  baseMs = DEFAULT_POLL_MS,
  maxMs = DEFAULT_MAX_POLL_MS,
  consecutiveFailures,
  jitter = Math.random,
}: {
  baseMs?: number;
  maxMs?: number;
  consecutiveFailures: number;
  jitter?: () => number;
}): number {
  const failures = Math.max(0, Math.floor(consecutiveFailures));
  if (failures === 0) return baseMs;

  // Clamping the exponent before the multiply keeps a long-failing tab from
  // computing Infinity and losing the cap.
  const backoff = Math.min(maxMs, baseMs * 2 ** Math.min(failures, 20));

  // Jitter across the top quarter of the window breaks lockstep between tabs
  // without letting the cadence collapse back toward baseMs.
  const spread = backoff * 0.25;
  return Math.round(backoff - spread * jitter());
}
