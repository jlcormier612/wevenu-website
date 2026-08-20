/**
 * Migration Center — repository layer. Every function here takes an
 * explicit client + venueId, matching this codebase's established
 * white-glove pattern (an authenticated session client + its own resolved
 * venueId for self-service, or an admin/service-role client + an explicit
 * venueId for HQ-assisted) — no session resolution happens in this file.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";
import type {
  MatchType,
  MigrationEntityType,
  MigrationRecord,
  MigrationSession,
  RecordStatus,
  SessionStatus,
  SourceKey,
} from "@/lib/migration/types";

function mapSession(r: Record<string, unknown>): MigrationSession {
  return {
    id: r.id as string,
    venueId: r.venue_id as string,
    sourceKey: r.source_key as SourceKey,
    status: r.status as SessionStatus,
    createdByType: r.created_by_type as MigrationSession["createdByType"],
    createdBy: (r.created_by ?? null) as string | null,
    engagementId: (r.engagement_id ?? null) as string | null,
    resumable: r.resumable as boolean,
    startedAt: r.started_at as string,
    lastActivityAt: r.last_activity_at as string,
    completedAt: (r.completed_at ?? null) as string | null,
    createdAt: r.created_at as string,
  };
}

function mapRecord(r: Record<string, unknown>): MigrationRecord {
  return {
    id: r.id as string,
    sessionId: r.session_id as string,
    venueId: r.venue_id as string,
    sourceRowRef: (r.source_row_ref ?? null) as string | null,
    rawPayload: (r.raw_payload ?? {}) as Record<string, unknown>,
    targetEntityType: r.target_entity_type as MigrationEntityType,
    normalizedPayload: (r.normalized_payload ?? null) as Record<string, unknown> | null,
    status: r.status as RecordStatus,
    matchType: r.match_type as MatchType,
    matchedEntityId: (r.matched_entity_id ?? null) as string | null,
    matchConfidence: (r.match_confidence ?? null) as number | null,
    conflictFields: (r.conflict_fields ?? null) as MigrationRecord["conflictFields"],
    validationErrors: (r.validation_errors ?? null) as string[] | null,
    createdEntityId: (r.created_entity_id ?? null) as string | null,
    reviewedBy: (r.reviewed_by ?? null) as string | null,
    reviewedAt: (r.reviewed_at ?? null) as string | null,
    committedAt: (r.committed_at ?? null) as string | null,
    createdAt: r.created_at as string,
  };
}

export async function createSession(
  client: AnyDbClient,
  venueId: string,
  sourceKey: SourceKey,
  createdByType: "venue" | "hq_staff",
  createdBy: string | null,
  engagementId: string | null,
): Promise<MigrationSession | null> {
  const { data, error } = await client
    .from("migration_sessions")
    .insert({
      venue_id: venueId, source_key: sourceKey, created_by_type: createdByType,
      created_by: createdBy, engagement_id: engagementId,
    })
    .select("*").single<Record<string, unknown>>();
  if (error || !data) return null;
  return mapSession(data);
}

export async function getSession(client: AnyDbClient, venueId: string, sessionId: string): Promise<MigrationSession | null> {
  const { data } = await client.from("migration_sessions").select("*")
    .eq("id", sessionId).eq("venue_id", venueId).maybeSingle<Record<string, unknown>>();
  return data ? mapSession(data) : null;
}

export async function listSessions(client: AnyDbClient, venueId: string): Promise<MigrationSession[]> {
  const { data } = await client.from("migration_sessions").select("*")
    .eq("venue_id", venueId).order("created_at", { ascending: false }).limit(50);
  return ((data ?? []) as Record<string, unknown>[]).map(mapSession);
}

export async function updateSessionStatus(
  client: AnyDbClient, sessionId: string, status: SessionStatus,
): Promise<void> {
  const patch: Record<string, unknown> = { status, last_activity_at: new Date().toISOString() };
  if (status === "committed" || status === "partially_committed" || status === "failed") {
    patch.completed_at = new Date().toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("migration_sessions") as any).update(patch).eq("id", sessionId);
}

export async function touchSession(client: AnyDbClient, sessionId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("migration_sessions") as any).update({ last_activity_at: new Date().toISOString() }).eq("id", sessionId);
}

export async function insertRecords(
  client: AnyDbClient,
  sessionId: string,
  venueId: string,
  targetEntityType: MigrationEntityType,
  rows: { sourceRowRef: string | null; rawPayload: Record<string, unknown> }[],
): Promise<MigrationRecord[]> {
  if (rows.length === 0) return [];
  const { data, error } = await client.from("migration_records").insert(
    rows.map((r) => ({
      session_id: sessionId, venue_id: venueId, target_entity_type: targetEntityType,
      source_row_ref: r.sourceRowRef, raw_payload: r.rawPayload, status: "parsed",
    })),
  ).select("*");
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(mapRecord);
}

export async function listRecords(
  client: AnyDbClient, sessionId: string, status?: RecordStatus,
): Promise<MigrationRecord[]> {
  let q = client.from("migration_records").select("*").eq("session_id", sessionId);
  if (status) q = q.eq("status", status);
  const { data } = await q.order("created_at", { ascending: true }).limit(5000);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRecord);
}

export async function updateRecord(
  client: AnyDbClient, recordId: string, patch: Partial<{
    normalizedPayload: Record<string, unknown>;
    status: RecordStatus;
    matchType: MatchType;
    matchedEntityId: string | null;
    matchConfidence: number | null;
    conflictFields: Record<string, unknown> | null;
    validationErrors: string[] | null;
    createdEntityId: string;
    reviewedBy: string;
    reviewedAt: string;
    committedAt: string;
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.normalizedPayload !== undefined) row.normalized_payload = patch.normalizedPayload;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.matchType !== undefined) row.match_type = patch.matchType;
  if (patch.matchedEntityId !== undefined) row.matched_entity_id = patch.matchedEntityId;
  if (patch.matchConfidence !== undefined) row.match_confidence = patch.matchConfidence;
  if (patch.conflictFields !== undefined) row.conflict_fields = patch.conflictFields;
  if (patch.validationErrors !== undefined) row.validation_errors = patch.validationErrors;
  if (patch.createdEntityId !== undefined) row.created_entity_id = patch.createdEntityId;
  if (patch.reviewedBy !== undefined) row.reviewed_by = patch.reviewedBy;
  if (patch.reviewedAt !== undefined) row.reviewed_at = patch.reviewedAt;
  if (patch.committedAt !== undefined) row.committed_at = patch.committedAt;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("migration_records") as any).update(row).eq("id", recordId);
}

// ---- Commit-race protection (atomic claim) ─────────────────────────────────
// Status (validated/approved) is deliberately left untouched by claiming —
// only claimed_at/claimed_by change — so the resumability state machine and
// history view need no changes to understand a claimed-but-not-yet-resolved
// record; it still reads as "pending commit."

/**
 * Attempts to atomically claim exactly one record for commit. The
 * conditional UPDATE (`WHERE status IN (...) AND claimed_at IS NULL`) is
 * what makes this race-safe: if two requests race for the same record,
 * Postgres serializes the two UPDATEs — whichever commits first satisfies
 * the WHERE clause and gets the row back; the second's WHERE clause no
 * longer matches (claimed_at is no longer null), affects zero rows, and
 * this returns null, telling that caller it lost the race and must not
 * proceed. No application-level lock — the guarantee comes entirely from
 * the database's own row-level update semantics.
 */
export async function claimRecord(client: AnyDbClient, recordId: string, claimedBy: string | null): Promise<MigrationRecord | null> {
  const { data } = await client.from("migration_records")
    .update({ claimed_at: new Date().toISOString(), claimed_by: claimedBy })
    .eq("id", recordId)
    .in("status", ["validated", "approved"])
    .is("claimed_at", null)
    .select("*")
    .maybeSingle<Record<string, unknown>>();
  return data ? mapRecord(data) : null;
}

/** Releases a claim after the attempt resolves (success or failure) — tidy-up, not itself part of the correctness guarantee. */
export async function releaseClaim(client: AnyDbClient, recordId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("migration_records") as any).update({ claimed_at: null, claimed_by: null }).eq("id", recordId);
}

/**
 * Recovery from a crashed/killed process that claimed a record but never
 * resolved it: any record still claimed, still `validated`/`approved`,
 * older than the staleness threshold is released so a later commit
 * attempt can retry it. Never touches a record a genuinely still-running
 * commit legitimately holds — the threshold is generous relative to how
 * long one record's entity-creation call actually takes.
 */
export async function releaseStaleClaims(client: AnyDbClient, sessionId: string, staleBeforeIso: string): Promise<void> {
  await client.from("migration_records")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ claimed_at: null, claimed_by: null } as any)
    .eq("session_id", sessionId)
    .in("status", ["validated", "approved"])
    .not("claimed_at", "is", null)
    .lt("claimed_at", staleBeforeIso);
}

/** Records currently claimed (genuinely in-flight, or not yet reclaimed as stale) — used so a concurrent commit's own final status computation doesn't prematurely report a session "done" while another request is still processing part of it. */
export async function countInFlightClaims(client: AnyDbClient, sessionId: string): Promise<number> {
  const { count } = await client.from("migration_records")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .in("status", ["validated", "approved"])
    .not("claimed_at", "is", null);
  return count ?? 0;
}

export async function linkDocument(client: AnyDbClient, sessionId: string, documentId: string): Promise<void> {
  await client.from("migration_session_documents").insert({ session_id: sessionId, document_id: documentId });
}

export async function listSessionDocumentIds(client: AnyDbClient, sessionId: string): Promise<string[]> {
  const { data } = await client.from("migration_session_documents").select("document_id").eq("session_id", sessionId);
  return ((data ?? []) as { document_id: string }[]).map((r) => r.document_id);
}
