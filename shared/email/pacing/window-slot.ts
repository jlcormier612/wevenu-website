/**
 * Sliding 1-second window slot acquisition for Resend team RPS.
 *
 * Provider docs describe a "per-second window" but do not guarantee alignment
 * with our unix-second boundaries. A fixed epoch counter allows an unsafe
 * adjacent-second burst (e.g. 9 @ T=999ms + 9 @ T=1000ms) inside any
 * provider-aligned 1000ms lookback. This module therefore counts acquires in
 * the trailing 1000ms (sliding), not a calendar second bucket.
 *
 * Bulk cannot consume more than maxBulk of the maxTotal slots in the window.
 * Critical may use any remaining of maxTotal (including the reserved band).
 */

import type { EmailSendPriority } from "./priority";

export const RESEND_PROVIDER_RPS = 10;
/** Conservative operational target under the verified 10 rps team limit. */
export const RESEND_PACING_MAX_TOTAL = 9;
/** Bulk ceiling so ≥ (maxTotal - maxBulk) slots stay available for critical. */
export const RESEND_PACING_MAX_BULK = 6;
export const RESEND_PACING_CRITICAL_RESERVED =
  RESEND_PACING_MAX_TOTAL - RESEND_PACING_MAX_BULK;
/** Sliding lookback matching one provider second. */
export const RESEND_PACING_WINDOW_MS = 1000;

export type SlidingAcquireEvent = {
  atMs: number;
  priority: EmailSendPriority;
};

export type SlotAcquireGranted = {
  granted: true;
  atMs: number;
  criticalCount: number;
  bulkCount: number;
  total: number;
};

export type SlotAcquireDenied = {
  granted: false;
  atMs: number;
  criticalCount: number;
  bulkCount: number;
  total: number;
  /** Milliseconds until the oldest in-window event ages out (or 1). */
  retryAfterMs: number;
  reason: "window_full" | "bulk_cap";
};

export type SlotAcquireResult = SlotAcquireGranted | SlotAcquireDenied;

/** @deprecated Use sliding events; kept for migration of older tests. */
export type WindowCounters = {
  windowEpoch: number;
  criticalCount: number;
  bulkCount: number;
};

export function windowEpochFromMs(nowMs: number): number {
  return Math.floor(nowMs / 1000);
}

export function msUntilNextWindow(nowMs: number): number {
  const epoch = windowEpochFromMs(nowMs);
  return Math.max(1, (epoch + 1) * 1000 - nowMs);
}

function countsInWindow(
  events: SlidingAcquireEvent[],
  nowMs: number,
  windowMs: number,
): { criticalCount: number; bulkCount: number; total: number; oldestAtMs: number | null } {
  const start = nowMs - windowMs;
  let criticalCount = 0;
  let bulkCount = 0;
  let oldestAtMs: number | null = null;
  for (const e of events) {
    if (e.atMs <= start) continue;
    if (oldestAtMs == null || e.atMs < oldestAtMs) oldestAtMs = e.atMs;
    if (e.priority === "critical") criticalCount += 1;
    else bulkCount += 1;
  }
  return { criticalCount, bulkCount, total: criticalCount + bulkCount, oldestAtMs };
}

function retryAfterFromOldest(nowMs: number, windowMs: number, oldestAtMs: number | null): number {
  if (oldestAtMs == null) return 1;
  return Math.max(1, oldestAtMs + windowMs - nowMs + 1);
}

/**
 * Pure try-once acquire against a shared event log (mutates `events` on grant).
 * Mirrors SQL acquire_resend_send_slot sliding semantics.
 */
export function tryAcquireSlidingSlot(
  events: SlidingAcquireEvent[],
  priority: EmailSendPriority,
  opts: {
    nowMs: number;
    maxTotal?: number;
    maxBulk?: number;
    windowMs?: number;
  },
): SlotAcquireResult {
  const maxTotal = opts.maxTotal ?? RESEND_PACING_MAX_TOTAL;
  const maxBulk = opts.maxBulk ?? RESEND_PACING_MAX_BULK;
  const windowMs = opts.windowMs ?? RESEND_PACING_WINDOW_MS;
  const nowMs = opts.nowMs;

  // Drop events outside 2× window (same prune horizon as SQL).
  const pruneBefore = nowMs - windowMs * 2;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.atMs <= pruneBefore) events.splice(i, 1);
  }

  const { criticalCount, bulkCount, total, oldestAtMs } = countsInWindow(events, nowMs, windowMs);
  const retryAfterMs = retryAfterFromOldest(nowMs, windowMs, oldestAtMs);

  if (priority === "bulk") {
    if (bulkCount >= maxBulk) {
      return {
        granted: false,
        atMs: nowMs,
        criticalCount,
        bulkCount,
        total,
        retryAfterMs,
        reason: "bulk_cap",
      };
    }
    if (total >= maxTotal) {
      return {
        granted: false,
        atMs: nowMs,
        criticalCount,
        bulkCount,
        total,
        retryAfterMs,
        reason: "window_full",
      };
    }
    events.push({ atMs: nowMs, priority: "bulk" });
    return {
      granted: true,
      atMs: nowMs,
      criticalCount,
      bulkCount: bulkCount + 1,
      total: total + 1,
    };
  }

  if (total >= maxTotal) {
    return {
      granted: false,
      atMs: nowMs,
      criticalCount,
      bulkCount,
      total,
      retryAfterMs,
      reason: "window_full",
    };
  }
  events.push({ atMs: nowMs, priority: "critical" });
  return {
    granted: true,
    atMs: nowMs,
    criticalCount: criticalCount + 1,
    bulkCount,
    total: total + 1,
  };
}

/**
 * @deprecated Fixed-window helper — unsafe across adjacent seconds if the
 * provider window is misaligned. Prefer tryAcquireSlidingSlot.
 */
export function tryAcquireWindowSlot(
  state: WindowCounters,
  priority: EmailSendPriority,
  opts: {
    nowMs: number;
    maxTotal?: number;
    maxBulk?: number;
  },
): SlotAcquireResult {
  // Compatibility shim used only by legacy tests migrating to sliding.
  const events: SlidingAcquireEvent[] = [];
  for (let i = 0; i < state.criticalCount; i++) {
    events.push({ atMs: opts.nowMs, priority: "critical" });
  }
  for (let i = 0; i < state.bulkCount; i++) {
    events.push({ atMs: opts.nowMs, priority: "bulk" });
  }
  const result = tryAcquireSlidingSlot(events, priority, opts);
  if (result.granted) {
    state.windowEpoch = windowEpochFromMs(opts.nowMs);
    state.criticalCount = result.criticalCount;
    state.bulkCount = result.bulkCount;
  }
  return result;
}

export function acquireManySequential(
  priority: EmailSendPriority,
  count: number,
  opts: {
    nowMs: number;
    maxTotal?: number;
    maxBulk?: number;
    events?: SlidingAcquireEvent[];
  },
): {
  granted: number;
  denied: number;
  events: SlidingAcquireEvent[];
  results: SlotAcquireResult[];
} {
  const events = opts.events ?? [];
  const results: SlotAcquireResult[] = [];
  let granted = 0;
  let denied = 0;
  for (let i = 0; i < count; i++) {
    const r = tryAcquireSlidingSlot(events, priority, opts);
    results.push(r);
    if (r.granted) granted += 1;
    else denied += 1;
  }
  return { granted, denied, events, results };
}

/**
 * Prove adjacent-millisecond / second-boundary safety: any contiguous
 * windowMs span of grants must be ≤ maxTotal.
 */
export function maxGrantsInAnySlidingWindow(
  grantTimesMs: number[],
  windowMs = RESEND_PACING_WINDOW_MS,
): number {
  if (grantTimesMs.length === 0) return 0;
  const sorted = [...grantTimesMs].sort((a, b) => a - b);
  let max = 0;
  let left = 0;
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right]! - sorted[left]! >= windowMs) left += 1;
    max = Math.max(max, right - left + 1);
  }
  return max;
}
