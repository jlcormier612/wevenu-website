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
};

function mapConnection(r: ConnectionRow): QuickBooksConnection {
  return {
    id: r.id, venueId: r.venue_id, realmId: r.realm_id, environment: r.environment,
    status: r.status,
    lastHealthCheckAt: r.last_health_check_at, lastHealthCheckOk: r.last_health_check_ok,
    lastError: r.last_error, lastErrorAt: r.last_error_at,
    companyName: r.company_name,
    connectedAt: r.connected_at, disconnectedAt: r.disconnected_at,
  };
}

function mapConnectionWithTokens(r: ConnectionRow): ConnectionWithTokens {
  return {
    venueId: r.venue_id, realmId: r.realm_id,
    accessToken: r.access_token, accessTokenExpiresAt: r.access_token_expires_at,
    refreshToken: r.refresh_token, refreshTokenExpiresAt: r.refresh_token_expires_at,
    status: r.status, defaultItemQuickBooksId: r.default_item_quickbooks_id,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDueBatch(client: any, limit = 50): Promise<SyncQueueRow[]> {
  const { data, error } = await client
    .from("quickbooks_sync_queue")
    .select("*")
    .in("status", ["pending", "failed_retrying"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as SyncQueueRow[];
}

/** Atomically claims one row — returns true iff this call actually won the claim (guards against a second, overlapping processor invocation). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function claimQueueItem(client: any, id: string): Promise<boolean> {
  const { data, error } = await client
    .from("quickbooks_sync_queue")
    .update({ status: "processing" })
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
