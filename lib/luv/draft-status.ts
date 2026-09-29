/**
 * Pure Luv draft status helpers — safe for Client Components.
 * Keep server I/O in lib/luv/drafts.ts.
 */

export type LuvDraftStatus = "pending_review" | "accepted" | "discarded";

type DraftStatusRow = {
  id: string;
  status: LuvDraftStatus;
};

/**
 * Pending-review list for the lead Luv panel.
 * Only `pending_review` drafts appear; accepted (copied or successfully sent)
 * and discarded drafts move to draft history.
 */
export function pendingReviewDrafts<T extends DraftStatusRow>(drafts: T[]): T[] {
  return drafts.filter((d) => d.status === "pending_review");
}

/**
 * After an authoritative Messages send that originated from "Send this →",
 * the draft is complete — same terminal status as Copy ("accepted").
 * Do not call this on a failed send, or merely because the venue opened the
 * composer from a draft.
 */
export function draftStatusAfterSuccessfulSend(): "accepted" {
  return "accepted";
}

/** Apply a terminal status to one draft without mutating other drafts. */
export function withDraftStatus<T extends DraftStatusRow>(
  drafts: T[],
  draftId: string,
  status: LuvDraftStatus,
): T[] {
  return drafts.map((d) => (d.id === draftId ? { ...d, status } : d));
}
