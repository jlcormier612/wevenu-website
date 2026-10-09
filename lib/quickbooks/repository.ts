/**
 * QuickBooks data access layer. Server-only.
 *
 * Two shapes are returned deliberately: getConnection() strips
 * access_token/refresh_token before returning (safe to pass to Settings UI
 * server actions), while getConnectionWithTokens() (internal-only, used by
 * lib/quickbooks/client.ts) returns the full row including token material.
 * Never let the token-bearing shape leave lib/quickbooks/.
 */
import { createClient } from "@/integrations/supabase/server";
import type { QuickBooksConnection, QuickBooksConnectionStatus } from "@/lib/quickbooks/types";
import { classifyClaim } from "@/lib/quickbooks/queue-recovery";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type ConnectionRow = {
  id: string; venue_id: string; realm_id: string;
  access_token: string; access_token_expires_at: string;
  refresh_token: string; refresh_token_expires_at: string;
  environment: "sandbox" | "production";
  status: QuickBooksConnectionStatus;
  last_health_check_at: string | null; last_health_check_ok: boolean | null;
  last_error: string | null; last_error_at: string | null;
  default_item_quickbooks_id: string | null;
  default_income_account_quickbooks_id: string | null;
  default_income_account_name: string | null;
  company_name: string | null;
  connected_at: string; disconnected_at: string | null;
};

export type ConnectionWithTokens = {
  venueId: string;
  realmId: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  status: QuickBooksConnectionStatus;
  defaultItemQuickBooksId: string | null;
  defaultIncomeAccountQuickBooksId: string | null;
};

function mapConnection(r: ConnectionRow): QuickBooksConnection {
  return {
    id: r.id, venueId: r.venue_id, realmId: r.realm_id, environment: r.environment,
    status: r.status,
    lastHealthCheckAt: r.last_health_check_at, lastHealthCheckOk: r.last_health_check_ok,
    lastError: r.last_error, lastErrorAt: r.last_error_at,
    companyName: r.company_name,
    defaultIncomeAccountQuickBooksId: r.default_income_account_quickbooks_id,
    defaultIncomeAccountName: r.default_income_account_name,
    connectedAt: r.connected_at, disconnectedAt: r.disconnected_at,
  };
}

function mapConnectionWithTokens(r: ConnectionRow): ConnectionWithTokens {
  return {
    venueId: r.venue_id, realmId: r.realm_id,
    accessToken: r.access_token, accessTokenExpiresAt: r.access_token_expires_at,
    refreshToken: r.refresh_token, refreshTokenExpiresAt: r.refresh_token_expires_at,
    status: r.status, defaultItemQuickBooksId: r.default_item_quickbooks_id,
    defaultIncomeAccountQuickBooksId: r.default_income_account_quickbooks_id,
  };
}

export async function getConnection(client: DbClient, venueId: string): Promise<QuickBooksConnection | null> {
  const { data } = await client.from("quickbooks_connections").select("*").eq("venue_id", venueId).maybeSingle<ConnectionRow>();
  return data ? mapConnection(data) : null;
}

/** Internal-only — includes token material. Never expose this shape to a UI action. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConnectionWithTokens(client: any, venueId: string): Promise<ConnectionWithTokens | null> {
  const { data } = await client.from("quickbooks_connections").select("*").eq("venue_id", venueId).maybeSingle();
  return data ? mapConnectionWithTokens(data as ConnectionRow) : null;
}

export async function upsertConnection(
  client: DbClient, venueId: string,
  input: {
    realmId: string; accessToken: string; accessTokenExpiresAt: string;
    refreshToken: string; refreshTokenExpiresAt: string; environment: "sandbox" | "production";
    companyName?: string | null;
  },
): Promise<void> {
  const { error } = await client.from("quickbooks_connections").upsert(
    {
      venue_id: venueId,
      realm_id: input.realmId,
      access_token: input.accessToken,
      access_token_expires_at: input.accessTokenExpiresAt,
      refresh_token: input.refreshToken,
      refresh_token_expires_at: input.refreshTokenExpiresAt,
      environment: input.environment,
      company_name: input.companyName ?? null,
      status: "connected",
      disconnected_at: null,
    },
    { onConflict: "venue_id" },
  );
  if (error) throw error;
}

/** Called by lib/quickbooks/client.ts after a successful token refresh — persists the rotated refresh token immediately (QBO invalidates the old one on every use). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateTokens(client: any, venueId: string, input: { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string }): Promise<void> {
  const { error } = await client.from("quickbooks_connections").update({
    access_token: input.accessToken,
    access_token_expires_at: input.accessTokenExpiresAt,
    refresh_token: input.refreshToken,
    refresh_token_expires_at: input.refreshTokenExpiresAt,
    status: "connected",
  }).eq("venue_id", venueId);
  if (error) throw error;
}

export async function disconnectConnection(client: DbClient, venueId: string): Promise<void> {
  const { error } = await client.from("quickbooks_connections").update({
    status: "disconnected",
    disconnected_at: new Date().toISOString(),
  }).eq("venue_id", venueId);
  if (error) throw error;
}

/** The refresh token itself is dead (expired/revoked) — a human must reconnect. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setConnectionError(client: any, venueId: string, error: string): Promise<void> {
  const { error: dbError } = await client.from("quickbooks_connections").update({
    status: "error",
    last_error: error,
    last_error_at: new Date().toISOString(),
  }).eq("venue_id", venueId);
  if (dbError) throw dbError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recordHealthCheck(client: any, venueId: string, ok: boolean, error?: string): Promise<void> {
  const patch: Record<string, unknown> = {
    last_health_check_at: new Date().toISOString(),
    last_health_check_ok: ok,
  };
  if (!ok && error) {
    patch.last_error = error;
    patch.last_error_at = new Date().toISOString();
  }
  const { error: dbError } = await client.from("quickbooks_connections").update(patch).eq("venue_id", venueId);
  if (dbError) throw dbError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setDefaultItemId(client: any, venueId: string, itemId: string): Promise<void> {
  const { error } = await client.from("quickbooks_connections").update({ default_item_quickbooks_id: itemId }).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Records the venue's explicit income-account choice. Scoped to the one
 * connection row for this venue — a venue can never write another venue's
 * selection. Writes only the two account columns, so an in-flight sync's
 * token or item state is never disturbed by a settings change.
 */
export async function setDefaultIncomeAccount(
  client: DbClient, venueId: string, account: { id: string; name: string },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("quickbooks_connections") as any)
    .update({
      default_income_account_quickbooks_id: account.id,
      default_income_account_name: account.name,
    })
    .eq("venue_id", venueId);
  if (error) throw error;
}

// ── quickbooks_sync_queue ────────────────────────────────────────────────────

export type SyncQueueRow = {
  id: string; venue_id: string;
  entity_type: "customer" | "invoice" | "payment" | "refund";
  entity_id: string; operation: "upsert";
  status: "pending" | "processing" | "succeeded" | "failed_retrying" | "dead_letter";
  attempt_count: number; max_attempts: number; next_attempt_at: string;
  last_error: string | null;
};

/**
 * Upserts against the partial unique index (venue_id, entity_type,
 * entity_id, operation) where status is unresolved. A duplicate enqueue of
 * the exact same pending state is a no-op (payload_hash unchanged); a
 * legitimate edit after a prior resolved sync gets its own fresh row,
 * since the partial index only covers unresolved statuses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enqueueSync(client: any, input: {
  venueId: string; entityType: "customer" | "invoice" | "payment" | "refund"; entityId: string; payloadHash: string;
}): Promise<void> {
  // Any existing *unresolved* row for this exact entity gets its hash/
  // next_attempt_at refreshed only if the payload actually changed —
  // never resets attempt_count on a mere duplicate signal.
  const { data: existing } = await client
    .from("quickbooks_sync_queue")
    .select("id, payload_hash")
    .eq("venue_id", input.venueId).eq("entity_type", input.entityType).eq("entity_id", input.entityId).eq("operation", "upsert")
    .in("status", ["pending", "processing", "failed_retrying"])
    .maybeSingle();
  const existingRow = existing as { id: string; payload_hash: string } | null;

  if (existingRow) {
    if (existingRow.payload_hash !== input.payloadHash) {
      const { error } = await client.from("quickbooks_sync_queue")
        .update({ payload_hash: input.payloadHash, next_attempt_at: new Date().toISOString() })
        .eq("id", existingRow.id);
      if (error) throw error;
    }
    return;
  }

  const { error } = await client.from("quickbooks_sync_queue").insert({
    venue_id: input.venueId, entity_type: input.entityType, entity_id: input.entityId,
    operation: "upsert", payload_hash: input.payloadHash,
  });
  if (error) throw error;
}

/**
 * Manual "Retry now" — finds this entity's most recent queue row
 * (dead_letter or still-retrying; whichever exists) and resets it to
 * pending with a fresh attempt budget, so a coordinator-triggered retry
 * gets the same full 8-attempt allowance a brand-new sync would, not
 * whatever was left when it originally dead-lettered. Uses the session
 * client — RLS (venue_id = current_user_venue_id()) is the actual
 * security boundary, not an app-level venue check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resetQueueItemForRetry(client: any, entityType: string, entityId: string): Promise<boolean> {
  const { data: existing } = await client
    .from("quickbooks_sync_queue")
    .select("id")
    .eq("entity_type", entityType).eq("entity_id", entityId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = existing as { id: string } | null;
  if (!row) return false;

  const { error } = await client.from("quickbooks_sync_queue").update({
    status: "pending", attempt_count: 0, next_attempt_at: new Date().toISOString(), last_error: null,
  }).eq("id", row.id);
  return !error;
}

/**
 * Due work, restricted to venues that can actually sync. Filtering here rather
 * than after the claim is what stops a disconnected venue's backlog being
 * claimed and released on every tick — the churn that stranded rows in
 * 'processing' when a sweep died between the two writes.
 *
 * venueIds is required so the caller cannot accidentally fall back to an
 * unfiltered sweep; an empty list legitimately means "nothing can sync".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDueBatch(client: any, limit = 50, venueIds: string[]): Promise<SyncQueueRow[]> {
  if (venueIds.length === 0) return [];
  const { data, error } = await client
    .from("quickbooks_sync_queue")
    .select("*")
    .in("status", ["pending", "failed_retrying"])
    .in("venue_id", venueIds)
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SyncQueueRow[];
}

/** Venues whose queue is eligible this tick. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getConnectedVenueIds(client: any): Promise<string[]> {
  const { data, error } = await client
    .from("quickbooks_connections")
    .select("venue_id")
    .eq("status", "connected");
  if (error) throw error;
  return ((data ?? []) as { venue_id: string }[]).map((r) => r.venue_id);
}

/**
 * Marks the point past which an Intuit call may have happened. Set in its own
 * write immediately before dispatch so that, within one claim, a null
 * last_attempted_at proves no external call was made.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markDispatchStarted(client: any, id: string): Promise<void> {
  const { error } = await client
    .from("quickbooks_sync_queue")
    .update({ last_attempted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export type ClaimRecoveryResult = { reclaimed: number; needsReview: number };

type ProcessingClaimRow = { id: string; updated_at: string | null; last_attempted_at: string | null };

/**
 * Returns abandoned pre-dispatch claims to the queue and counts the stale
 * claims that are not safe to replay automatically.
 *
 * Only rows with no dispatch marker are touched, so this cannot cause a second
 * Intuit write. attempt_count is deliberately left alone: nothing was
 * attempted, so nothing should count toward the dead-letter ceiling.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reclaimAbandonedClaims(client: any, leaseMs: number): Promise<ClaimRecoveryResult> {
  const { data, error } = await client
    .from("quickbooks_sync_queue")
    .select("id, updated_at, last_attempted_at")
    .eq("status", "processing");
  if (error) throw error;

  // classifyClaim is the single definition of what counts as abandoned, so the
  // tested rule and the executed rule cannot drift apart.
  const nowMs = Date.now();
  const reclaimable: string[] = [];
  let needsReview = 0;
  for (const row of (data ?? []) as ProcessingClaimRow[]) {
    const verdict = classifyClaim({
      updatedAt: row.updated_at,
      lastAttemptedAt: row.last_attempted_at,
      nowMs,
      leaseMs,
    });
    if (verdict === "reclaimable") reclaimable.push(row.id);
    else if (verdict === "needs_review") needsReview++;
  }

  if (reclaimable.length === 0) return { reclaimed: 0, needsReview };

  const { data: reclaimedRows, error: updateError } = await client
    .from("quickbooks_sync_queue")
    .update({ status: "pending", next_attempt_at: new Date().toISOString() })
    .in("id", reclaimable)
    // Re-asserted at write time: a row that was dispatched or resolved between
    // the read above and this update must not be reclaimed.
    .eq("status", "processing")
    .is("last_attempted_at", null)
    .select("id");
  if (updateError) throw updateError;

  return { reclaimed: (reclaimedRows ?? []).length, needsReview };
}

export type QueueSnapshot = {
  /** Due work for venues that cannot sync yet. Retained, never discarded. */
  deferredNoConnection: number;
  /** Age of the oldest item that is due and whose venue can sync, in ms. */
  oldestEligiblePendingAgeMs: number | null;
};

/** Counts and ages only — no venue, entity or customer data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getQueueSnapshot(client: any, connectedVenueIds: string[]): Promise<QueueSnapshot> {
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("quickbooks_sync_queue")
    .select("venue_id, created_at")
    .in("status", ["pending", "failed_retrying"])
    .lte("next_attempt_at", nowIso);
  if (error) throw error;

  const connected = new Set(connectedVenueIds);
  let deferredNoConnection = 0;
  let oldestEligible: number | null = null;

  for (const row of (data ?? []) as { venue_id: string; created_at: string }[]) {
    if (!connected.has(row.venue_id)) {
      deferredNoConnection++;
      continue;
    }
    const createdMs = Date.parse(row.created_at);
    if (Number.isNaN(createdMs)) continue;
    if (oldestEligible === null || createdMs < oldestEligible) oldestEligible = createdMs;
  }

  return {
    deferredNoConnection,
    oldestEligiblePendingAgeMs: oldestEligible === null ? null : Date.now() - oldestEligible,
  };
}

/** Atomically claims one row — returns true iff this call actually won the claim (guards against a second, overlapping processor invocation). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function claimQueueItem(client: any, id: string): Promise<boolean> {
  const { data, error } = await client
    .from("quickbooks_sync_queue")
    // Cleared so the dispatch marker describes this claim, not a prior attempt.
    // last_error_at still carries when the previous attempt failed.
    .update({ status: "processing", last_attempted_at: null })
    .in("status", ["pending", "failed_retrying"])
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueSucceeded(client: any, id: string): Promise<void> {
  const { error } = await client.from("quickbooks_sync_queue").update({ status: "succeeded" }).eq("id", id);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueFailedRetrying(client: any, id: string, attemptCount: number, nextAttemptAt: string, error: string): Promise<void> {
  const { error: dbError } = await client.from("quickbooks_sync_queue").update({
    status: "failed_retrying", attempt_count: attemptCount, next_attempt_at: nextAttemptAt,
    last_error: error, last_error_at: new Date().toISOString(), last_attempted_at: new Date().toISOString(),
  }).eq("id", id);
  if (dbError) throw dbError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueDeadLetter(client: any, id: string, attemptCount: number, error: string): Promise<void> {
  const { error: dbError } = await client.from("quickbooks_sync_queue").update({
    status: "dead_letter", attempt_count: attemptCount,
    last_error: error, last_error_at: new Date().toISOString(), last_attempted_at: new Date().toISOString(),
  }).eq("id", id);
  if (dbError) throw dbError;
}

/**
 * Records a write whose outcome Intuit never confirmed. Status deliberately
 * stays 'processing' and attempt_count is untouched: the dispatch marker is
 * already set, so the existing lease logic surfaces this as needs_review
 * rather than ever replaying it automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markQueueUncertain(client: any, id: string, error: string): Promise<void> {
  const { error: dbError } = await client.from("quickbooks_sync_queue").update({
    last_error: error, last_error_at: new Date().toISOString(),
  }).eq("id", id);
  if (dbError) throw dbError;
}

/** Leaves a pending/failed_retrying item untouched (doesn't burn an attempt) — used when the venue's connection isn't currently 'connected'. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function releaseQueueItem(client: any, id: string): Promise<void> {
  const { error } = await client.from("quickbooks_sync_queue").update({ status: "pending" }).eq("id", id);
  if (error) throw error;
}

// ── quickbooks_sync_log ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertSyncLog(client: any, input: {
  venueId: string; queueId: string; entityType: string; entityId: string;
  outcome: "succeeded" | "failed" | "dead_lettered"; attemptNumber: number;
  quickbooksId?: string | null; message?: string | null;
}): Promise<void> {
  const { error } = await client.from("quickbooks_sync_log").insert({
    venue_id: input.venueId, queue_id: input.queueId, entity_type: input.entityType, entity_id: input.entityId,
    outcome: input.outcome, attempt_number: input.attemptNumber,
    quickbooks_id: input.quickbooksId ?? null, message: input.message ?? null,
  });
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRecentSyncLog(client: any, venueId: string, limit = 20) {
  const { data, error } = await client
    .from("quickbooks_sync_log")
    .select("*")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as {
    id: string; entity_type: string; entity_id: string;
    outcome: "succeeded" | "failed" | "dead_lettered"; attempt_number: number;
    quickbooks_id: string | null; message: string | null; created_at: string;
  }[];
}
