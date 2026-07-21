export type QuickBooksSyncResult =
  | { ok: true; quickbooksId: string }
  | { ok: false; error: string; retryable: boolean };
