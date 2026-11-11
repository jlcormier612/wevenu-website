export type QuickBooksSyncResult =
  | {
      ok: true;
      quickbooksId: string;
      /**
       * Refund reconcile only: confirmed net-retained amount on the remote
       * Payment (paid − refunded). Persisted as quickbooks_refund_net_synced
       * — a cache of remote state, not the source of truth.
       */
      refundNetSynced?: number;
    }
  /**
   * uncertain marks a write whose outcome Intuit never confirmed — the
   * processor holds these for review rather than retrying, because a replay
   * could create a second financial record.
   */
  | { ok: false; error: string; retryable: boolean; uncertain?: boolean };
