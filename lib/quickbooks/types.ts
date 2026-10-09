export type QuickBooksConnectionStatus = "connected" | "disconnected" | "error";

export type QuickBooksConnection = {
  id: string;
  venueId: string;
  realmId: string;
  environment: "sandbox" | "production";
  status: QuickBooksConnectionStatus;
  lastHealthCheckAt: string | null;
  lastHealthCheckOk: boolean | null;
  lastError: string | null;
  lastErrorAt: string | null;
  companyName: string | null;
  /** The income account the venue chose for the default Service Item. Never auto-set. */
  defaultIncomeAccountQuickBooksId: string | null;
  defaultIncomeAccountName: string | null;
  connectedAt: string;
  disconnectedAt: string | null;
};

export type QuickBooksSyncStatus = "not_synced" | "pending" | "synced" | "failed";

export type QuickBooksEntityType = "customer" | "invoice" | "payment" | "refund";

export type QuickBooksSyncQueueStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed_retrying"
  | "dead_letter";

export type QuickBooksSyncLogEntry = {
  id: string;
  entityType: QuickBooksEntityType;
  entityId: string;
  outcome: "succeeded" | "failed" | "dead_lettered";
  attemptNumber: number;
  quickbooksId: string | null;
  message: string | null;
  createdAt: string;
};

export type QuickBooksActionResult =
  | { ok: true }
  | { ok: false; message: string };
