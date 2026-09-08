/**
 * Communication Trust Experience — Phase 3.
 *
 * Shared ordering for the outbound message lifecycle (draft → sending →
 * accepted → delivered → opened → clicked → replied), used to decide
 * whether an incoming webhook/event should actually update a message's
 * status. Webhooks can arrive out of order (a click notification racing a
 * delivery notification) or redundantly (a provider retrying its own
 * webhook) — a later, lower-rank event must never erase a higher one a
 * venue owner has already seen. "failed" is a special case: it always
 * records (a bounce after "accepted" is real news), and once failed, nothing
 * un-fails a message automatically. "received" (inbound messages) and
 * "draft" never flow through this — they're not part of the outbound chain.
 */

const STATUS_RANK: Record<string, number> = {
  draft: 0,
  sending: 1,
  accepted: 2,
  delivered: 3,
  opened: 4,
  clicked: 5,
  replied: 6,
};

const TERMINAL_FAILURE = new Set(["failed", "undelivered"]);

export function shouldAdvanceStatus(current: string | null | undefined, next: string): boolean {
  // Failure / undelivered always records — a bounce after "accepted" is real news.
  if (TERMINAL_FAILURE.has(next)) return true;
  // Once failed or undelivered, nothing un-fails a message automatically.
  if (current && TERMINAL_FAILURE.has(current)) return false;
  const curRank = current ? (STATUS_RANK[current] ?? -1) : -1;
  const nextRank = STATUS_RANK[next] ?? -1;
  return nextRank > curRank;
}
