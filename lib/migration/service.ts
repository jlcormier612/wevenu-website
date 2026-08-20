/**
 * Migration Center — session orchestration service.
 *
 * One engine, two entry points (self-service venue session vs. HQ-assisted
 * on-behalf-of), matching this codebase's already-established "one
 * migration platform serving two audiences, not two different products"
 * decision (Hospitality Success Platform §2.2) — every function below
 * takes an explicit actor context rather than branching internally.
 *
 * V1 supports committing to `client`, `lead`, and `vendor` — the three
 * entity types that map cleanly onto a single existing canonical create
 * call. `event`/`payment`/`document` are real MigrationEntityType values
 * for forward compatibility, but nothing in this file wires them to
 * creation yet — not promising an import we can't safely commit today.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { requireAdminUser } from "@/lib/hq/crm-service";
import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";

import { createClientForVenue, createClient_ } from "@/lib/clients/service";
import { createLead, createLeadForVenue } from "@/lib/leads/service";
import { createVendor, createVendorForVenue } from "@/lib/vendors/service";
import type { ClientInput } from "@/lib/clients/types";
import type { LeadInput } from "@/lib/leads/types";
import type { VendorInput } from "@/lib/vendors/types";

import * as repo from "@/lib/migration/repository";
import * as documentsRepo from "@/lib/documents/repository";
import { dedupe } from "@/lib/migration/dedupe";
import { getSourceAdapter } from "@/lib/migration/source-profiles";
import { createImportBatch, createImportBatchForVenue, finalizeImportBatch, stampImportBatch } from "@/lib/import/batches";
import type {
  CommitOutcome,
  MigrationEntityType,
  MigrationRecord,
  MigrationSession,
  NormalizedClientLike,
  NormalizedLeadLike,
  NormalizedVendorLike,
  RecordStatus,
  SessionResumeState,
  SessionSourceFile,
  SessionSummary,
  SourceKey,
  SourceRow,
} from "@/lib/migration/types";

type AnyDbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

type Actor = { client: AnyDbClient; venueId: string; createdByType: "venue" | "hq_staff"; createdBy: string | null };

/** Resolves the self-service (venue-session) actor context, or a typed error. */
async function resolveVenueActor(): Promise<Actor | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return { client: supabase, venueId: venue.id, createdByType: "venue", createdBy: user.id };
}

/** Resolves the HQ-assisted (on-behalf-of) actor context, or a typed error. */
async function resolveAdminActor(venueId: string): Promise<Actor | { ok: false; message: string }> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  return { client: createAdminClient(), venueId, createdByType: "hq_staff", createdBy: actor.userId };
}

function isError(a: Actor | { ok: false; message: string }): a is { ok: false; message: string } {
  return "ok" in a && a.ok === false;
}

// ---- session lifecycle -------------------------------------------------------

export async function startSelfServiceSession(sourceKey: SourceKey): Promise<{ ok: true; session: MigrationSession } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.createSession(actor.client, actor.venueId, sourceKey, "venue", actor.createdBy, null);
  if (!session) return { ok: false, message: "Could not start a migration session." };
  return { ok: true, session };
}

export async function startAdminSession(
  venueId: string, sourceKey: SourceKey, engagementId: string | null,
): Promise<{ ok: true; session: MigrationSession } | { ok: false; message: string }> {
  const actor = await resolveAdminActor(venueId);
  if (isError(actor)) return actor;
  const session = await repo.createSession(actor.client, actor.venueId, sourceKey, "hq_staff", actor.createdBy, engagementId);
  if (!session) return { ok: false, message: "Could not start a migration session." };
  return { ok: true, session };
}

export async function getSessionForVenue(venueId: string, sessionId: string, admin = false): Promise<MigrationSession | null> {
  const actor = admin ? await resolveAdminActor(venueId) : await resolveVenueActor();
  if (isError(actor)) return null;
  return repo.getSession(actor.client, venueId, sessionId);
}

export async function listSessionsForCurrentVenue(): Promise<MigrationSession[]> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return [];
  return repo.listSessions(actor.client, actor.venueId);
}

// ---- ingest: raw rows → normalized migration_records -------------------------

/**
 * Parses+normalizes every row through the session's source adapter and
 * stores the result immediately — a row the adapter can't make sense of
 * becomes `needs_review` with its error recorded, never silently dropped.
 * Safe to call more than once for the same session (e.g. a second file);
 * each call only adds new records.
 */
export async function addRows(
  client: AnyDbClient, session: MigrationSession, entityType: MigrationEntityType, rows: SourceRow[],
): Promise<{ added: number }> {
  const adapter = getSourceAdapter(session.sourceKey);
  const toInsert = rows.map((row, i) => ({ sourceRowRef: `row ${i + 1}`, rawPayload: row as Record<string, unknown> }));
  const inserted = await repo.insertRecords(client, session.id, session.venueId, entityType, toInsert);

  for (let i = 0; i < inserted.length; i++) {
    const record = inserted[i];
    const row = rows[i];
    const result = adapter.normalizeRow(row, entityType);
    if (!result.ok) {
      await repo.updateRecord(client, record.id, { status: "needs_review", validationErrors: [result.error] });
      continue;
    }
    await repo.updateRecord(client, record.id, { status: "normalized", normalizedPayload: result.normalized });
  }

  await repo.touchSession(client, session.id);
  return { added: inserted.length };
}

// ---- dedupe pass ---------------------------------------------------------------

/**
 * Runs the duplicate/conflict check (docs/migration-cutover-architecture.md
 * §B.4) over every `normalized` record in the session. A clean, unmatched
 * record becomes `validated` — ready to auto-commit, no human needed. An
 * exact match becomes `duplicate_exact` (will be skipped, shows the
 * match). A likely match becomes `duplicate_likely`, requiring an explicit
 * review decision before it can commit. Idempotent: re-running only
 * touches records still in `normalized` status.
 */
export async function runDedupe(client: AnyDbClient, session: MigrationSession): Promise<void> {
  const normalized = await repo.listRecords(client, session.id, "normalized");
  for (const record of normalized) {
    if (!record.normalizedPayload) continue;
    const result = await dedupe(client, session.venueId, record.targetEntityType, record.normalizedPayload);
    if (result.matchType === "exact") {
      await repo.updateRecord(client, record.id, {
        status: "duplicate_exact", matchType: "exact",
        matchedEntityId: result.matchedEntityId, matchConfidence: result.matchConfidence,
      });
    } else if (result.matchType === "likely") {
      await repo.updateRecord(client, record.id, {
        status: "duplicate_likely", matchType: "likely",
        matchedEntityId: result.matchedEntityId, matchConfidence: result.matchConfidence,
      });
    } else {
      await repo.updateRecord(client, record.id, { status: "validated", matchType: "none" });
    }
  }
  await repo.updateSessionStatus(client, session.id, "ready_for_review");
}

// ---- review: a human decision on a likely-match/conflict/needs_review row ----

export async function reviewRecord(
  client: AnyDbClient, recordId: string, decision: "approve" | "reject", reviewedBy: string | null,
): Promise<void> {
  await repo.updateRecord(client, recordId, {
    status: decision === "approve" ? "approved" : "rejected",
    reviewedBy: reviewedBy ?? undefined,
    reviewedAt: new Date().toISOString(),
  });
}

// ---- summary (preview) ---------------------------------------------------------

const ALL_STATUSES: RecordStatus[] = [
  "parsed", "normalized", "validated", "duplicate_exact", "duplicate_likely",
  "conflict", "needs_review", "approved", "rejected", "committed", "skipped",
];

function emptyCounts(): Record<RecordStatus, number> {
  return Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<RecordStatus, number>;
}

export async function getSessionSummary(client: AnyDbClient, session: MigrationSession): Promise<SessionSummary> {
  const records = await repo.listRecords(client, session.id);
  const counts = emptyCounts();
  const byEntityType: SessionSummary["byEntityType"] = {};
  for (const r of records) {
    counts[r.status]++;
    if (!byEntityType[r.targetEntityType]) byEntityType[r.targetEntityType] = emptyCounts();
    byEntityType[r.targetEntityType]![r.status]++;
  }
  return { session, counts, byEntityType };
}

// ---- commit ---------------------------------------------------------------------

const COMMITTABLE_ENTITY_TYPES: MigrationEntityType[] = ["client", "lead", "vendor"];
/** A record in any of these statuses still needs an explicit human decision before it can commit or be counted as done. */
const UNRESOLVED_STATUSES: RecordStatus[] = ["duplicate_likely", "conflict", "needs_review"];

/**
 * A session isn't simply "complete" or "failed" from one commit attempt's
 * outcome alone — records the venue hasn't made a decision on yet
 * (duplicate_likely/conflict/needs_review) may still remain, exactly as
 * intended by "commit valid records, leave unresolved records untouched"
 * (docs/migration-cutover-architecture.md §B.5). Pure and exported
 * specifically so this decision table is directly testable without a
 * database.
 */
export function computeFinalSessionStatus(outcome: CommitOutcome, stillUnresolvedCount: number): MigrationSession["status"] {
  if (stillUnresolvedCount > 0) {
    // Something was actually committed/skipped just now, but real work
    // remains — partial, not done. Nothing was committable at all (this
    // commit was a no-op against an unreviewed session) — leave it exactly
    // where the venue left it, ready for review, not silently advanced.
    return outcome.committed > 0 || outcome.skipped > 0 ? "partially_committed" : "ready_for_review";
  }
  if (outcome.committed === 0 && outcome.failed > 0) return "failed";
  if (outcome.failed > 0) return "partially_committed";
  return "committed";
}

function toClientInput(n: NormalizedClientLike): ClientInput {
  return {
    firstName: n.firstName, lastName: n.lastName,
    email: n.email ?? "", phone: n.phone ?? "",
    partnerFirstName: n.partnerFirstName ?? "", partnerLastName: n.partnerLastName ?? "", partnerEmail: "",
    eventType: n.eventType ?? "", eventDate: n.eventDate ?? "", endDate: "",
    guestCount: n.guestCount ?? "", ceremonyTime: "", receptionTime: "", rehearsalDate: "",
    internalNotes: n.notes ?? "",
  };
}

function toLeadInput(n: NormalizedLeadLike): LeadInput {
  return {
    firstName: n.firstName, lastName: n.lastName,
    email: n.email ?? "", phone: n.phone ?? "",
    partnerFirstName: n.partnerFirstName ?? "", partnerLastName: n.partnerLastName ?? "", partnerEmail: "",
    eventType: n.eventType ?? "", eventDate: n.eventDate ?? "", endDate: "",
    guestCount: n.guestCount ?? "", estimatedBudget: n.estimatedBudget ?? "",
    source: "other", inquiryMessage: n.inquiryMessage ?? "", inquiryDate: "",
  };
}

function toVendorInput(n: NormalizedVendorLike): VendorInput {
  return {
    businessName: n.businessName, category: n.category ?? "", contactName: n.contactName ?? "",
    email: n.email ?? "", phone: n.phone ?? "", websiteUrl: n.websiteUrl ?? "",
    instagramUrl: "", facebookUrl: "", pinterestUrl: "", tiktokUrl: "",
    preferenceLevel: "recommended",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/**
 * Commits every `validated`/`approved` record via the existing, unmodified
 * canonical create function for its entity type — always with
 * historicalImport true, since Migration Center exists specifically to
 * bring over backfilled data (docs/migration-cutover-architecture.md §B.3,
 * "quiet/historical commit mode"). `duplicate_exact` records are marked
 * skipped, not committed. Idempotent/resumable: only records still in
 * `validated`/`approved` are processed, so re-running after an interruption
 * picks up exactly where it left off — an already-`committed` record is
 * never re-created.
 */
export async function commitSession(client: AnyDbClient, session: MigrationSession, adminId: string | null): Promise<CommitOutcome> {
  await repo.updateSessionStatus(client, session.id, "committing");

  const outcome: CommitOutcome = { committed: 0, skipped: 0, failed: 0 };
  const duplicates = await repo.listRecords(client, session.id, "duplicate_exact");
  for (const record of duplicates) {
    await repo.updateRecord(client, record.id, { status: "skipped" });
    outcome.skipped++;
  }

  for (const entityType of COMMITTABLE_ENTITY_TYPES) {
    const committable = [
      ...(await repo.listRecords(client, session.id, "validated")),
      ...(await repo.listRecords(client, session.id, "approved")),
    ].filter((r) => r.targetEntityType === entityType);
    if (committable.length === 0) continue;

    const batchEntityType = entityType === "client" ? "couples" : entityType === "lead" ? "leads" : "vendors";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchClient = client as any;
    const batchId = session.createdByType === "hq_staff"
      ? await createImportBatchForVenue(batchClient, session.venueId, batchEntityType, session.sourceKey, committable.length, adminId ?? "unknown", session.engagementId, session.id)
      : await createImportBatch(session.venueId, batchEntityType, session.sourceKey, committable.length, batchClient, session.id);

    const createdIds: string[] = [];
    for (const record of committable) {
      if (!record.normalizedPayload) { outcome.failed++; continue; }
      const result = await commitOneRecord(session, entityType, record);
      if (result.ok) {
        await repo.updateRecord(client, record.id, { status: "committed", createdEntityId: result.entityId, committedAt: new Date().toISOString() });
        createdIds.push(result.entityId);
        outcome.committed++;
      } else {
        await repo.updateRecord(client, record.id, { status: "needs_review", validationErrors: [result.error] });
        outcome.failed++;
      }
    }
    if (createdIds.length > 0) await stampImportBatch(batchEntityType, batchId, createdIds, batchClient);
    await finalizeImportBatch(batchId, { imported: createdIds.length, skipped: 0, errors: committable.length - createdIds.length }, batchClient);
  }

  // A session isn't simply "complete" or "failed" from this one commit
  // attempt's outcome alone — records the venue hasn't made a decision on
  // yet (duplicate_likely/conflict/needs_review) may still remain, exactly
  // as intended by "commit valid records, leave unresolved records
  // untouched" (docs/migration-cutover-architecture.md §B.5). Status must
  // reflect the session's *actual current state*, not just this run.
  const allRecords = await repo.listRecords(client, session.id);
  const stillUnresolved = allRecords.filter((r) => UNRESOLVED_STATUSES.includes(r.status)).length;
  const finalStatus = computeFinalSessionStatus(outcome, stillUnresolved);
  await repo.updateSessionStatus(client, session.id, finalStatus);
  return outcome;
}

// ---- self-service convenience wrappers (resolve the venue actor internally,
//      for direct use from server actions) ------------------------------------

export async function addRowsToOwnSession(
  sessionId: string, entityType: MigrationEntityType, rows: SourceRow[],
): Promise<{ ok: true; added: number } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  const result = await addRows(actor.client, session, entityType, rows);
  return { ok: true, ...result };
}

export async function runDedupeForOwnSession(sessionId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  await runDedupe(actor.client, session);
  return { ok: true };
}

export async function getOwnSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return null;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return null;
  return getSessionSummary(actor.client, session);
}

export async function reviewOwnRecord(
  sessionId: string, recordId: string, decision: "approve" | "reject",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  await reviewRecord(actor.client, recordId, decision, actor.createdBy);
  return { ok: true };
}

export async function commitOwnSession(sessionId: string): Promise<{ ok: true; outcome: CommitOutcome } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  const outcome = await commitSession(actor.client, session, null);
  return { ok: true, outcome };
}

// ---- Slice 1: original file retention (docs/migration-cutover-architecture.md
//      §B.2) — the file is saved as an ordinary venue-level `documents` row
//      (reusing the existing storage/document architecture wholesale, not a
//      parallel one) and linked to its session via migration_session_documents.

/**
 * Saves an already-uploaded-to-storage file's metadata as a venue-level
 * document (tagged `migration_source`) and links it to the session in one
 * step. The actual storage upload happens client-side first (same
 * mechanism components/document-workspace/upload-button.tsx already uses —
 * the `documents` bucket, an unguessable `migration/{sessionId}/{docId}.
 * {ext}` path) — this only ever touches metadata + the join row.
 */
export async function attachSourceFileToOwnSession(
  sessionId: string,
  file: { fileName: string; fileSize: number; mimeType: string; storagePath: string; storageUrl: string },
): Promise<{ ok: true; documentId: string } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };

  const documentId = await documentsRepo.insertVenueDocument(actor.client, actor.venueId, {
    name: file.fileName, category: "other", notes: "", tags: "migration_source",
    expiresAt: "", fileName: file.fileName, fileSize: file.fileSize, mimeType: file.mimeType,
    storagePath: file.storagePath, storageUrl: file.storageUrl,
  });
  await repo.linkDocument(actor.client, sessionId, documentId);
  return { ok: true, documentId };
}

export async function getOwnSessionSourceFiles(sessionId: string): Promise<SessionSourceFile[]> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return [];
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return [];
  const documentIds = await repo.listSessionDocumentIds(actor.client, sessionId);
  if (documentIds.length === 0) return [];
  const { data } = await actor.client.from("documents")
    .select("id, file_name, file_size, mime_type, storage_url, created_at")
    .in("id", documentIds)
    .eq("venue_id", actor.venueId); // defense in depth — belt-and-suspenders alongside the venue-scoped session lookup above
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    documentId: r.id as string,
    fileName: r.file_name as string,
    fileSize: (r.file_size ?? null) as number | null,
    mimeType: (r.mime_type ?? null) as string | null,
    storageUrl: r.storage_url as string,
    uploadedAt: r.created_at as string,
  }));
}

// ---- Slice 2: resumability — what step should the UI resume into ─────────

/**
 * Pure decision table, exported specifically so it's directly testable:
 * given a session's record-status counts, which step should the UI resume
 * into. `parsed`/`normalized` counting as "still processing" is what makes
 * an interruption between addRows and runDedupe (e.g. a network drop, a
 * closed tab) correctly resumable — the rows themselves are already
 * durably persisted as migration_records; only the dedupe pass, not the
 * upload, needs to run again.
 */
export function computeSessionResumeState(counts: SessionSummary["counts"]): SessionResumeState {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const unresolved = counts.duplicate_likely + counts.conflict + counts.needs_review;
  const settled = counts.committed + counts.skipped + counts.rejected; // no further action possible on these
  const pendingCommit = counts.validated + counts.approved; // dedupe-clean or explicitly approved, not yet actually written

  if (total === 0) return "empty";
  if (counts.parsed > 0 || counts.normalized > 0) return "needs_processing";

  if (settled === 0) {
    // Nothing has actually been committed/skipped yet — the whole session
    // is still in review, even when some records are also already clean
    // and ready (the realistic, common case: most rows are fine, a few
    // need a look). Unresolved work takes priority in what's shown.
    return unresolved > 0 ? "needs_review" : "ready_to_commit";
  }
  // Something has already been committed/skipped — partial unless every
  // remaining record has also been settled.
  return unresolved > 0 || pendingCommit > 0 ? "partially_done" : "done";
}

export async function getOwnSessionResumeState(sessionId: string): Promise<{ state: SessionResumeState; summary: SessionSummary } | null> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return null;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return null;
  const summary = await getSessionSummary(actor.client, session);
  return { state: computeSessionResumeState(summary.counts), summary };
}

async function commitOneRecord(
  session: MigrationSession, entityType: MigrationEntityType, record: MigrationRecord,
): Promise<{ ok: true; entityId: string } | { ok: false; error: string }> {
  const isAdmin = session.createdByType === "hq_staff";
  if (entityType === "client") {
    const input = toClientInput(record.normalizedPayload as unknown as NormalizedClientLike);
    const result = isAdmin
      ? await createClientForVenue(session.venueId, input, true)
      : await createClient_(input, true);
    if (!result.ok) return { ok: false, error: result.message ?? "Could not create client." };
    return { ok: true, entityId: result.clientId };
  }
  if (entityType === "lead") {
    const input = toLeadInput(record.normalizedPayload as unknown as NormalizedLeadLike);
    const result = isAdmin
      ? await createLeadForVenue(session.venueId, input, true)
      : await createLead(input, "import", true);
    if (!result.ok) return { ok: false, error: result.message ?? "Could not create lead." };
    return { ok: true, entityId: result.leadId };
  }
  if (entityType === "vendor") {
    const input = toVendorInput(record.normalizedPayload as unknown as NormalizedVendorLike);
    const result = isAdmin
      ? await createVendorForVenue(session.venueId, input)
      : await createVendor(input);
    if (!result.ok) return { ok: false, error: result.message ?? "Could not create vendor." };
    return { ok: true, entityId: result.vendorId };
  }
  return { ok: false, error: `Committing "${entityType}" records isn't supported yet.` };
}
