/**
 * Abandoned-claim recovery for the QuickBooks sync queue.
 *
 * Mirrors lib/facebook/lead-mapping.ts's isStaleProcessing, with the one
 * distinction external financial writes demand: replaying facebook_lead_queue
 * work is harmless because it only touches our own tables, whereas replaying a
 * QuickBooks push that may already have reached Intuit can create a second
 * Customer, Invoice, Payment or RefundReceipt.
 *
 * quickBooksFetch sets no request timeout, so the maximum legitimate
 * processing time is unbounded and no lease can prove a worker is dead.
 * Recovery therefore never relies on the lease alone. claimQueueItem clears
 * last_attempted_at and markDispatchStarted sets it immediately before the
 * first Intuit call, so within a single claim the column answers exactly one
 * question: could this item have reached Intuit? A stale claim that still has
 * no timestamp is provably pre-dispatch and safe to replay. One that has a
 * timestamp is held for review rather than retried automatically — the
 * read-before-write lookup in each sync module reduces the odds of a duplicate
 * but does not make the create atomic, so it is not a safety guarantee.
 */

/** Three cron periods. Recovery latency only — never a safety boundary. */
export const QUEUE_LEASE_MS = 15 * 60 * 1000;

export type AbandonedClaimVerdict =
  /** Still inside the lease — leave it alone. */
  | "fresh"
  /** Stale and provably pre-dispatch — safe to return to the queue. */
  | "reclaimable"
  /** Stale but may have called Intuit — needs a human before any replay. */
  | "needs_review";

export function classifyClaim(input: {
  /** When the row was last written, i.e. when it was claimed. */
  updatedAt: string | null;
  /** Null unless this claim reached markDispatchStarted. */
  lastAttemptedAt: string | null;
  nowMs: number;
  leaseMs?: number;
}): AbandonedClaimVerdict {
  const leaseMs = input.leaseMs ?? QUEUE_LEASE_MS;
  const claimedAtMs = input.updatedAt ? Date.parse(input.updatedAt) : Number.NaN;
  // A missing or unreadable claim time cannot be shown to be stale, and the
  // conservative reading of "unknown" is to leave the row untouched.
  if (Number.isNaN(claimedAtMs)) return "fresh";
  if (input.nowMs - claimedAtMs < leaseMs) return "fresh";
  return input.lastAttemptedAt ? "needs_review" : "reclaimable";
}
