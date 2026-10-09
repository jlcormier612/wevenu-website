export type QuickBooksSyncResult =
  | { ok: true; quickbooksId: string }
  /**
   * uncertain marks a write whose outcome Intuit never confirmed — the
   * processor holds these for review rather than retrying, because a replay
   * could create a second financial record.
   */
  | { ok: false; error: string; retryable: boolean; uncertain?: boolean };
