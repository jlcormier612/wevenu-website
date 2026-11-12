/**
 * Pure Luv draft status helpers — safe for Client Components.
 * Keep server I/O in lib/luv/drafts.ts.
 */

export type LuvDraftStatus = "pending_review" | "accepted" | "discarded";

export type DraftLifecycleWithdrawal = {
  withdrawnAt: string;
  reasonCode: string;
  reason: string;
};

type DraftStatusRow = {
  id: string;
  status: LuvDraftStatus;
  /** When set, draft is no longer actionable (lifecycle superseded). Status stays pending_review. */
  lifecycleWithdrawal?: DraftLifecycleWithdrawal | null;
};

/**
 * Pending-review list for the lead Luv panel.
 * Only actionable `pending_review` drafts appear. Lifecycle-withdrawn drafts
 * remain in the row set for history/explanation but are not actionable.
 * Accepted (copied or successfully sent) drafts move to draft history.
 * Discard deletes the row — it must not remain in local state or history.
 */
export function pendingReviewDrafts<T extends DraftStatusRow>(drafts: T[]): T[] {
  return drafts.filter(
    (d) => d.status === "pending_review" && !d.lifecycleWithdrawal?.withdrawnAt,
  );
}

/** Lifecycle-superseded drafts still stored as pending_review (not deleted). */
export function lifecycleWithdrawnDrafts<T extends DraftStatusRow>(drafts: T[]): T[] {
  return drafts.filter(
    (d) => d.status === "pending_review" && Boolean(d.lifecycleWithdrawal?.withdrawnAt),
  );
}

/**
 * Accepted/used drafts only — discarded drafts are deleted and never listed.
 */
export function draftHistoryDrafts<T extends DraftStatusRow>(drafts: T[]): T[] {
  return drafts.filter((d) => d.status === "accepted");
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

/** Stamp lifecycle withdrawal on one draft in local state. */
export function withLifecycleWithdrawal<T extends DraftStatusRow>(
  drafts: T[],
  draftId: string,
  withdrawal: DraftLifecycleWithdrawal,
): T[] {
  return drafts.map((d) =>
    d.id === draftId ? { ...d, lifecycleWithdrawal: withdrawal } : d,
  );
}

/** Remove a draft from local state after a successful Discard delete. */
export function withoutDraft<T extends DraftStatusRow>(
  drafts: T[],
  draftId: string,
): T[] {
  return drafts.filter((d) => d.id !== draftId);
}

/**
 * Discard UI: only remove locally after a successful delete.
 * Failed deletion keeps the draft visible and surfaces the error.
 */
export function applyDiscardResult<T extends DraftStatusRow>(
  drafts: T[],
  draftId: string,
  result: { ok: true } | { ok: false; message: string },
): { drafts: T[]; error: string | null } {
  if (!result.ok) return { drafts, error: result.message };
  return { drafts: withoutDraft(drafts, draftId), error: null };
}
