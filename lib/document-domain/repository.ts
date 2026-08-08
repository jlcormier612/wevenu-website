/**
 * Document Domain — Adapter Framework (Phase 5 / 2A).
 *
 * Shared adapter infrastructure (§4 of this phase's brief) — owner
 * resolution lives in owner-resolver.ts; this file is the reusable,
 * producer-agnostic write path every future adapter uses for: reference
 * creation, version creation, representation creation, audit writing,
 * event publishing, idempotency protection, and error handling.
 *
 * This is the ONLY module in the codebase permitted to touch
 * canonical_document_* tables directly (§7: "No producer may write
 * directly into canonical audit tables" — generalized here to every
 * canonical table, not just audit, since the same reasoning applies to
 * all of them: one shared mechanism, never seven ad hoc ones). A
 * producer-specific adapter (none implemented this phase) calls these
 * functions; it never issues its own `.from("canonical_documents")` call.
 *
 * No business rules live here — every function is a thin translation
 * from a typed TS input to the exact insert/update Phase 4's schema
 * already expects, with Postgres errors translated to typed rejections
 * (errors.ts) rather than validated a second time in JavaScript.
 */

import { createClient } from "@/integrations/supabase/server";
import type {
  AddReferenceInput,
  AdaptProducerInput,
  AdaptProducerResult,
  CanonicalActor,
  CanonicalActorType,
  CanonicalAuditEntry,
  CanonicalDocumentBehavior,
  CanonicalDocumentStatus,
  CanonicalRepresentation,
  CanonicalVersionSummary,
  CreateDocumentInput,
  CreateRepresentationInput,
  CreateVersionInput,
  EmitEventInput,
} from "@/lib/document-domain/types";
import { mapPostgresError, DocumentDomainError } from "@/lib/document-domain/errors";

type DbClient = Awaited<ReturnType<typeof createClient>>;

function throwTyped(error: unknown, context: Record<string, string> = {}): never {
  const pgError = error as { code?: string; message?: string; details?: string };
  const typed = mapPostgresError(pgError, context);
  if (typed) throw typed;
  throw error instanceof Error ? error : new DocumentDomainError(String(error), "unknown");
}

/** Reassembles the { type, id } actor shape from a row's *_type/*_id columns — used by every read function below. */
function actorFromRow(type: CanonicalActorType, id: string | null): CanonicalActor {
  if (type === "system" || type === "ai") return { type };
  return { type, id: id as string };
}

/**
 * The one atomic, idempotent entry point for "adapt a producer record
 * into the canonical Document Domain" — calls the DB-side
 * adapt_producer_to_canonical_document() RPC (20261214000000), which is
 * the only place this specific check-then-create is safe under
 * concurrency. See that migration's comment for why a two-round-trip
 * check-then-insert from application code is not sufficient.
 */
export async function adaptProducerToCanonicalDocument(
  client: DbClient,
  input: AdaptProducerInput,
): Promise<AdaptProducerResult> {
  const { data, error } = await client
    .rpc("adapt_producer_to_canonical_document", {
      p_owner_type: input.owner.type,
      p_owner_id: input.owner.type === "system" ? null : input.owner.id,
      p_source: input.source,
      p_type: input.type,
      p_behavior: input.behavior,
      p_name: input.name,
      p_reference_type: input.referenceType,
      p_reference_id: input.referenceId,
      p_reference_role: input.referenceRole ?? "produced_by",
    })
    .single<{ document_id: string; created: boolean }>();

  if (error) throwTyped(error, { ownerType: input.owner.type, referenceType: input.referenceType, referenceId: input.referenceId, role: input.referenceRole ?? "produced_by" });
  return { documentId: data.document_id, created: data.created };
}

export async function createDocument(client: DbClient, input: CreateDocumentInput): Promise<{ documentId: string }> {
  const { data, error } = await client
    .from("canonical_documents")
    .insert({
      owner_type: input.owner.type,
      owner_id: input.owner.type === "system" ? null : input.owner.id,
      source: input.source,
      type: input.type,
      behavior: input.behavior,
      name: input.name,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      expires_at: input.expiresAt ?? null,
      retention_policy: input.retentionPolicy ?? null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throwTyped(error, { ownerType: input.owner.type });
  return { documentId: data.id };
}

export async function createVersion(client: DbClient, input: CreateVersionInput): Promise<{ versionId: string; sequenceNumber: number }> {
  // sequence_number is assigned by counting existing versions rather than
  // relying on a DB sequence/trigger — Phase 4 deliberately left this to
  // the writer (see canonical_document_versions_sequence_unique, which
  // enforces uniqueness but not assignment) since only the writer knows
  // whether it is creating version 1 or replacing a superseded one.
  const { count } = await client
    .from("canonical_document_versions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", input.documentId);

  const sequenceNumber = (count ?? 0) + 1;

  // canonical_document_versions_one_current (Phase 4) enforces at most one
  // is_current=true row per Document — a real gap surfaced by this phase's
  // own validation: this function inserted every new version with the
  // is_current default (true) without ever clearing it on the version it
  // supersedes, so any second call for the same Document would always
  // violate that constraint. Not a design change — the certified Version
  // model already means "the new version becomes current, superseding the
  // old one"; this statement is what actually enacts that.
  if (sequenceNumber > 1) {
    const { error: clearError } = await client
      .from("canonical_document_versions")
      .update({ is_current: false })
      .eq("document_id", input.documentId)
      .eq("is_current", true);
    if (clearError) throwTyped(clearError, { documentId: input.documentId });
  }

  const { data, error } = await client
    .from("canonical_document_versions")
    .insert({
      document_id: input.documentId,
      sequence_number: sequenceNumber,
      content: input.content ?? null,
      created_by_type: input.createdBy.type,
      created_by_id: input.createdBy.type === "system" || input.createdBy.type === "ai" ? null : input.createdBy.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throwTyped(error, { documentId: input.documentId });
  return { versionId: data.id, sequenceNumber };
}

/** Sets locked_at exactly once — the immutability marker (architecture §4A). Never clears it. */
export async function lockVersion(client: DbClient, versionId: string): Promise<void> {
  const { error } = await client
    .from("canonical_document_versions")
    .update({ locked_at: new Date().toISOString() })
    .eq("id", versionId)
    .is("locked_at", null); // no-op if already locked — locking is idempotent, never re-stamped
  if (error) throwTyped(error, { versionId });
}

export async function createRepresentation(client: DbClient, input: CreateRepresentationInput): Promise<{ representationId: string }> {
  const { data, error } = await client
    .from("canonical_document_representations")
    .insert({
      version_id: input.versionId,
      representation_type: input.representationType,
      storage_provider: input.storageProvider ?? "supabase",
      storage_path: input.storagePath ?? null,
      storage_url: input.storageUrl ?? null,
      mime_type: input.mimeType ?? null,
      byte_size: input.byteSize ?? null,
      checksum: input.checksum ?? null,
      generated_by_type: input.generatedBy.type,
      generated_by_id: input.generatedBy.type === "system" || input.generatedBy.type === "ai" ? null : input.generatedBy.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throwTyped(error, { versionId: input.versionId, representationType: input.representationType });
  return { representationId: data.id };
}

export async function addReference(client: DbClient, input: AddReferenceInput): Promise<{ referenceId: string }> {
  const { data, error } = await client
    .from("canonical_document_references")
    .insert({
      document_id: input.documentId,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      role: input.role,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) throwTyped(error, { referenceType: input.referenceType, referenceId: input.referenceId, role: input.role });
  return { referenceId: data.id };
}

export async function transitionStatus(client: DbClient, documentId: string, toStatus: CanonicalDocumentStatus): Promise<void> {
  const { error } = await client
    .from("canonical_documents")
    .update({ status: toStatus })
    .eq("id", documentId);
  if (error) throwTyped(error, { documentId });
}

/**
 * The single shared audit/event mechanism (§6, §7) — wraps the
 * emit_canonical_document_event() RPC from Phase 4, which writes BOTH
 * canonical_document_events and canonical_document_audit in one call.
 * This is why "Write Audit Entry" is not a separately-callable function
 * here: every event emission already writes its audit entry as a
 * structural side effect, so there is no second path that could write
 * audit without an event, or vice versa — one mechanism, not two that
 * could drift apart.
 */
export async function emitEvent(client: DbClient, input: EmitEventInput): Promise<{ eventId: string }> {
  const { data, error } = await client
    .rpc("emit_canonical_document_event", {
      p_document_id: input.documentId,
      p_event_type: input.eventType,
      p_actor_type: input.actor.type,
      p_actor_id: input.actor.type === "system" || input.actor.type === "ai" ? null : input.actor.id,
      p_version_id: input.versionId ?? null,
      p_payload: input.payload ?? {},
    })
    .single<string>();

  if (error) throwTyped(error, { documentId: input.documentId, eventType: input.eventType });
  return { eventId: data as unknown as string };
}

// ── Read operations (Phase 6 / 2B) ───────────────────────────────────────────
// "Retrieve current Representation," "Retrieve version history," "Retrieve
// audit history" (§2 of this phase's brief) — the first read paths this
// module has had; Phase 5 was write-only. Same rule as every write
// function above: no business logic, a straight, typed read of exactly
// what Phase 4's schema already stores.

/**
 * Just enough of a Document's own row to drive translation decisions
 * (event-translation.ts's eventForFinalization() needs Behavior; nothing
 * in the integration layer needs more than this) — not a general-purpose
 * "get everything" read, since nothing calling this needs the rest.
 */
export async function getDocumentBehavior(client: DbClient, documentId: string): Promise<CanonicalDocumentBehavior> {
  const { data, error } = await client
    .from("canonical_documents")
    .select("behavior")
    .eq("id", documentId)
    .single<{ behavior: CanonicalDocumentBehavior }>();
  if (error) throwTyped(error, { documentId });
  return data.behavior;
}

/** The Document a given Version belongs to — needed by the integration layer's generateRepresentation(), which is called with only a versionId (§2's own shape) and must still record its event against the owning Document. */
export async function getDocumentIdForVersion(client: DbClient, versionId: string): Promise<string> {
  const { data, error } = await client
    .from("canonical_document_versions")
    .select("document_id")
    .eq("id", versionId)
    .single<{ document_id: string }>();
  if (error) throwTyped(error, { versionId });
  return data.document_id;
}

/** The current Version's Representation, if one exists — null if the Document has no current version, or that version has none yet (still Draft). */
export async function getCurrentRepresentation(client: DbClient, documentId: string): Promise<CanonicalRepresentation | null> {
  const { data: version, error: versionError } = await client
    .from("canonical_document_versions")
    .select("id")
    .eq("document_id", documentId)
    .eq("is_current", true)
    .maybeSingle<{ id: string }>();
  if (versionError) throwTyped(versionError, { documentId });
  if (!version) return null;

  const { data, error } = await client
    .from("canonical_document_representations")
    .select("*")
    .eq("version_id", version.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwTyped(error, { versionId: version.id });
  if (!data) return null;

  return {
    id: data.id,
    versionId: data.version_id,
    representationType: data.representation_type,
    storageProvider: data.storage_provider,
    storagePath: data.storage_path,
    storageUrl: data.storage_url,
    mimeType: data.mime_type,
    byteSize: data.byte_size,
    checksum: data.checksum,
    generatedBy: actorFromRow(data.generated_by_type, data.generated_by_id),
    createdAt: data.created_at,
  };
}

/** Every Version for a Document, oldest first — the full sequence, not just the current one. */
export async function getVersionHistory(client: DbClient, documentId: string): Promise<CanonicalVersionSummary[]> {
  const { data, error } = await client
    .from("canonical_document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("sequence_number", { ascending: true });
  if (error) throwTyped(error, { documentId });

  return (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    sequenceNumber: row.sequence_number,
    isCurrent: row.is_current,
    lockedAt: row.locked_at,
    createdBy: actorFromRow(row.created_by_type, row.created_by_id),
    createdAt: row.created_at,
  }));
}

/** The full append-only audit trail for a Document, newest first. */
export async function getAuditHistory(client: DbClient, documentId: string): Promise<CanonicalAuditEntry[]> {
  const { data, error } = await client
    .from("canonical_document_audit")
    .select("*")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false });
  if (error) throwTyped(error, { documentId });

  return (data ?? []).map((row) => ({
    id: row.id,
    documentId: row.document_id,
    versionId: row.version_id,
    action: row.action,
    actor: actorFromRow(row.actor_type, row.actor_id),
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
