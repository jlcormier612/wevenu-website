/**
 * Migration Center — session orchestration service.
 *
 * One engine, two entry points (self-service venue session vs. HQ-assisted
 * on-behalf-of). Commits always go through canonical create paths; availability
 * enforcement is never bypassed — conflicts surface as needs_review.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { requireAdminUser } from "@/lib/hq/crm-service";
import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";

import { createClientForVenue, createClient_ } from "@/lib/clients/service";
import { createLead, createLeadForVenue } from "@/lib/leads/service";
import { createVendor, createVendorForVenue } from "@/lib/vendors/service";
import { createPackage, createPackageForVenue } from "@/lib/packages/service";
import * as availRepo from "@/lib/availability/repository";
import * as eventsRepo from "@/lib/events/repository";
import * as clientsRepo from "@/lib/clients/repository";
import type { ClientInput } from "@/lib/clients/types";
import type { LeadInput } from "@/lib/leads/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { PackageInput } from "@/lib/packages/types";
import type { CalendarBlockInput, DateHoldInput, ManualScheduleType, BlockReason, RecurrenceRule } from "@/lib/availability/types";
import type { EventInput } from "@/lib/events/types";
import { occupancyFailureFromUnknown, CalendarBlockWriteError, OccupancyWriteError, calendarBlockFailureFromUnknown } from "@/lib/availability/event-occupancy";
import {
  historicalRecordReviewMessage,
  isHistoricalRecordEligibleError,
  isLiveAvailabilityConflictError,
  isPastEventDate,
} from "@/lib/migration/historical-record";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";

import * as repo from "@/lib/migration/repository";
import * as documentsRepo from "@/lib/documents/repository";
import { dedupe } from "@/lib/migration/dedupe";
import { getSourceAdapter } from "@/lib/migration/source-profiles";
import { createImportBatch, createImportBatchForVenue, finalizeImportBatch, stampImportBatch } from "@/lib/import/batches";
import { resolveClientIdByEmail, resolveLeadIdByEmail, resolveSpaceId } from "@/lib/migration/resolve-refs";
import type {
  CommitOutcome,
  MigrationEntityType,
  MigrationRecord,
  MigrationSession,
  NormalizedCalendarBlockLike,
  NormalizedClientLike,
  NormalizedDateHoldLike,
  NormalizedEventLike,
  NormalizedKeyDateLike,
  NormalizedLeadLike,
  NormalizedPackageLike,
  NormalizedTourLike,
  NormalizedVendorLike,
  RecordStatus,
  SessionResumeState,
  SessionSourceFile,
  SessionSummary,
  SourceKey,
  SourceRow,
} from "@/lib/migration/types";
import type { EntityType } from "@/lib/import/types";

type AnyDbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

type Actor = { client: AnyDbClient; venueId: string; createdByType: "venue" | "hq_staff"; createdBy: string | null };

async function resolveVenueActor(): Promise<Actor | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return { client: supabase, venueId: venue.id, createdByType: "venue", createdBy: user.id };
}

async function resolveAdminActor(venueId: string): Promise<Actor | { ok: false; message: string }> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  return { client: createAdminClient(), venueId, createdByType: "hq_staff", createdBy: actor.userId };
}

function isError(a: Actor | { ok: false; message: string }): a is { ok: false; message: string } {
  return "ok" in a && a.ok === false;
}

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

export async function reviewRecord(
  client: AnyDbClient, recordId: string, decision: "approve" | "reject" | "approve_historical", reviewedBy: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data } = await client.from("migration_records")
    .select("normalized_payload, validation_errors")
    .eq("id", recordId)
    .maybeSingle<{ normalized_payload: Record<string, unknown> | null; validation_errors: string[] | null }>();
  if (!data) return { ok: false, error: "That record is no longer in this migration." };
  const errors = data.validation_errors;
  const eventDate = (data.normalized_payload?.eventDate as string | undefined)
    ?? (data.normalized_payload?.eventEndDate as string | undefined)
    ?? null;

  if (decision === "approve_historical") {
    if (!isPastEventDate(eventDate) || !isHistoricalRecordEligibleError(errors)) {
      return { ok: false, error: "Only past Events that conflict with current availability can be imported as historical records." };
    }
    const payload = { ...(data.normalized_payload ?? {}), importAsHistoricalRecord: true };
    await repo.updateRecord(client, recordId, {
      status: "approved",
      normalizedPayload: payload,
      reviewedBy: reviewedBy ?? undefined,
      reviewedAt: new Date().toISOString(),
    });
    return { ok: true };
  }

  if (decision === "approve") {
    if (isHistoricalRecordEligibleError(errors)) {
      return { ok: false, error: "Use “Import as historical record — will not affect future availability.” Future availability is not changed that way." };
    }
    if (isLiveAvailabilityConflictError(errors)) {
      return { ok: false, error: "This still conflicts with availability. Resolve the conflict or skip the row — Hello to Cheers will not import it anyway." };
    }
  }

  await repo.updateRecord(client, recordId, {
    status: decision === "approve" ? "approved" : "rejected",
    reviewedBy: reviewedBy ?? undefined,
    reviewedAt: new Date().toISOString(),
  });
  return { ok: true };
}

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

const COMMITTABLE_ENTITY_TYPES: MigrationEntityType[] = [
  "calendar_block", "date_hold", "vendor", "lead", "client", "package", "event", "tour", "key_date",
];

const BATCH_ENTITY: Partial<Record<MigrationEntityType, EntityType>> = {
  client: "couples",
  lead: "leads",
  vendor: "vendors",
  package: "packages",
};

const UNRESOLVED_STATUSES: RecordStatus[] = ["duplicate_likely", "conflict", "needs_review"];

export function computeFinalSessionStatus(outcome: CommitOutcome, stillUnresolvedCount: number): MigrationSession["status"] {
  if (stillUnresolvedCount > 0) {
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
    eventType: n.eventType ?? "", eventDate: n.eventDate ?? "", endDate: n.endDate ?? "",
    guestCount: n.guestCount ?? "",
    ceremonyTime: n.startTime ?? "",
    receptionTime: n.endTime ?? "",
    setupTime: n.setupTime ?? "",
    teardownTime: n.teardownTime ?? "",
    rehearsalDate: "",
    internalNotes: n.notes ?? "",
    spaceId: n.spaceId ?? "",
  };
}

function toLeadInput(n: NormalizedLeadLike): LeadInput {
  return {
    firstName: n.firstName, lastName: n.lastName,
    email: n.email ?? "", phone: n.phone ?? "",
    partnerFirstName: n.partnerFirstName ?? "", partnerLastName: n.partnerLastName ?? "", partnerEmail: "",
    eventType: n.eventType ?? "", eventDate: n.eventDate ?? "", endDate: n.endDate ?? "",
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

const STALE_CLAIM_MS = 5 * 60 * 1000;

export async function commitSession(client: AnyDbClient, session: MigrationSession, actorId: string | null): Promise<CommitOutcome> {
  await repo.updateSessionStatus(client, session.id, "committing");
  await repo.releaseStaleClaims(client, session.id, new Date(Date.now() - STALE_CLAIM_MS).toISOString());

  const outcome: CommitOutcome = { committed: 0, skipped: 0, failed: 0 };
  const duplicates = await repo.listRecords(client, session.id, "duplicate_exact");
  for (const record of duplicates) {
    await repo.updateRecord(client, record.id, { status: "skipped" });
    outcome.skipped++;
  }

  for (const entityType of COMMITTABLE_ENTITY_TYPES) {
    const candidates = [
      ...(await repo.listRecords(client, session.id, "validated")),
      ...(await repo.listRecords(client, session.id, "approved")),
    ].filter((r) => r.targetEntityType === entityType);
    if (candidates.length === 0) continue;

    const batchEntityType = BATCH_ENTITY[entityType];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchClient = client as any;
    const batchId = batchEntityType
      ? (session.createdByType === "hq_staff"
        ? await createImportBatchForVenue(batchClient, session.venueId, batchEntityType, session.sourceKey, candidates.length, actorId ?? "unknown", session.engagementId, session.id)
        : await createImportBatch(session.venueId, batchEntityType, session.sourceKey, candidates.length, batchClient, session.id))
      : null;

    const createdIds: string[] = [];
    let claimedCount = 0;
    for (const candidate of candidates) {
      const record = await repo.claimRecord(client, candidate.id, actorId);
      if (!record) continue;
      claimedCount++;

      if (!record.normalizedPayload) {
        await repo.updateRecord(client, record.id, { status: "needs_review", validationErrors: ["Nothing to commit — this record was never normalized."] });
        await repo.releaseClaim(client, record.id);
        outcome.failed++;
        continue;
      }
      const result = await commitOneRecord(client, session, entityType, record);
      if (result.ok) {
        await repo.updateRecord(client, record.id, { status: "committed", createdEntityId: result.entityId, committedAt: new Date().toISOString() });
        await repo.releaseClaim(client, record.id);
        createdIds.push(result.entityId);
        outcome.committed++;
      } else {
        await repo.updateRecord(client, record.id, { status: "needs_review", validationErrors: [result.error] });
        await repo.releaseClaim(client, record.id);
        outcome.failed++;
      }
    }
    if (claimedCount === 0) continue;
    if (batchEntityType && createdIds.length > 0) await stampImportBatch(batchEntityType, batchId, createdIds, batchClient);
    await finalizeImportBatch(batchId, { imported: createdIds.length, skipped: 0, errors: claimedCount - createdIds.length }, batchClient);
  }

  const allRecords = await repo.listRecords(client, session.id);
  const stillUnresolved = allRecords.filter((r) => UNRESOLVED_STATUSES.includes(r.status)).length;
  const inFlight = await repo.countInFlightClaims(client, session.id);
  const finalStatus = computeFinalSessionStatus(outcome, stillUnresolved + inFlight);
  await repo.updateSessionStatus(client, session.id, finalStatus);
  return outcome;
}

export async function addRowsToOwnSession(
  sessionId: string, entityType: MigrationEntityType, rows: SourceRow[],
): Promise<{ ok: true; added: number } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  if (entityType === "event") {
    const blocked = await datedEventImportBlockedMessage(actor.client, actor.venueId);
    if (blocked) return { ok: false, message: blocked };
  }
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
  sessionId: string, recordId: string, decision: "approve" | "reject" | "approve_historical",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  const reviewed = await reviewRecord(actor.client, recordId, decision, actor.createdBy);
  if (!reviewed.ok) return { ok: false, message: reviewed.error };
  return { ok: true };
}

export async function commitOwnSession(sessionId: string): Promise<{ ok: true; outcome: CommitOutcome } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  const outcome = await commitSession(actor.client, session, actor.createdBy);
  return { ok: true, outcome };
}

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
    .eq("venue_id", actor.venueId);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    documentId: r.id as string,
    fileName: r.file_name as string,
    fileSize: (r.file_size ?? null) as number | null,
    mimeType: (r.mime_type ?? null) as string | null,
    storageUrl: r.storage_url as string,
    uploadedAt: r.created_at as string,
  }));
}

export function computeSessionResumeState(counts: SessionSummary["counts"]): SessionResumeState {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const unresolved = counts.duplicate_likely + counts.conflict + counts.needs_review;
  const settled = counts.committed + counts.skipped + counts.rejected;
  const pendingCommit = counts.validated + counts.approved;

  if (total === 0) return "empty";
  if (counts.parsed > 0 || counts.normalized > 0) return "needs_processing";

  if (settled === 0) {
    return unresolved > 0 ? "needs_review" : "ready_to_commit";
  }
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

function occupancyCommitError(err: unknown): string | null {
  const fail = occupancyFailureFromUnknown(err);
  if (fail) return fail.message;
  const blocked = calendarBlockFailureFromUnknown(err);
  if (blocked) return blocked.message;
  if (err instanceof OccupancyWriteError || err instanceof CalendarBlockWriteError) return err.message;
  if (err instanceof Error) return err.message;
  return null;
}

async function venueRequiresEventSpace(client: AnyDbClient, venueId: string): Promise<boolean> {
  const { data } = await client.from("venue_capacity_rules")
    .select("max_simultaneous_events")
    .eq("venue_id", venueId)
    .maybeSingle<{ max_simultaneous_events: number }>();
  return (data?.max_simultaneous_events ?? 1) >= 2;
}

async function datedEventImportBlockedMessage(client: AnyDbClient, venueId: string): Promise<string | null> {
  const [{ count }, { data: rules }] = await Promise.all([
    client.from("venue_spaces").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("is_active", true),
    client.from("venue_capacity_rules").select("max_simultaneous_events").eq("venue_id", venueId)
      .maybeSingle<{ max_simultaneous_events: number }>(),
  ]);
  const prereq = evaluateCutoverPrerequisites({
    spacesCount: count ?? 0,
    hasCapacityRules: !!rules,
    maxSimultaneousEvents: rules?.max_simultaneous_events ?? 1,
  });
  return prereq.readyForDatedEvents ? null : (prereq.message ?? "Add Event Spaces before importing dated Events.");
}

function pastConflictForReview(eventDate: string | null | undefined, error: string): string {
  return isPastEventDate(eventDate) ? historicalRecordReviewMessage(error) : error;
}

async function commitOneRecord(
  client: AnyDbClient,
  session: MigrationSession,
  entityType: MigrationEntityType,
  record: MigrationRecord,
): Promise<{ ok: true; entityId: string } | { ok: false; error: string }> {
  const isAdmin = session.createdByType === "hq_staff";
  try {
    if (entityType === "client") {
      const n = record.normalizedPayload as unknown as NormalizedClientLike & { importAsHistoricalRecord?: boolean };
      const asHistorical = !!n.importAsHistoricalRecord && isPastEventDate(n.eventDate);
      const requiresSpace = !asHistorical && !!n.eventDate && await venueRequiresEventSpace(client, session.venueId);
      const space = await resolveSpaceId(client, session.venueId, n.spaceId, n.spaceName);
      if (requiresSpace) {
        if (!space.ok) return { ok: false, error: pastConflictForReview(n.eventDate, space.error) };
        if (!space.spaceId) {
          return { ok: false, error: pastConflictForReview(n.eventDate, "Assign an Event Space before importing this dated Event. This venue can host more than one event at the same time.") };
        }
      } else if (!asHistorical && !space.ok && (n.spaceId || n.spaceName)) {
        return space;
      }
      const input = toClientInput({ ...n, spaceId: space.ok ? space.spaceId : null });
      const result = isAdmin
        ? await createClientForVenue(session.venueId, input, true, asHistorical)
        : await createClient_(input, true, asHistorical);
      if (!result.ok) {
        return { ok: false, error: pastConflictForReview(n.eventDate, result.message ?? "Could not create client.") };
      }
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
    if (entityType === "package") {
      const n = record.normalizedPayload as unknown as NormalizedPackageLike;
      const input: PackageInput = {
        name: n.name,
        description: n.description ?? "",
        basePrice: n.basePrice ?? "",
        category: n.category ?? "",
        isActive: true,
      };
      const result = isAdmin
        ? await createPackageForVenue(session.venueId, input)
        : await createPackage(input);
      if (!result.ok) return { ok: false, error: result.message ?? "Could not create package." };
      return { ok: true, entityId: result.packageId };
    }
    if (entityType === "calendar_block") {
      const n = record.normalizedPayload as unknown as NormalizedCalendarBlockLike;
      const input: CalendarBlockInput = {
        title: n.title,
        type: n.type as ManualScheduleType,
        reason: (n.reason as BlockReason | null) ?? (n.type === "blocked_time" ? "other" : null),
        startDate: n.startDate,
        endDate: n.endDate ?? n.startDate,
        isAllDay: n.isAllDay ?? true,
        startTime: n.startTime ?? "",
        endTime: n.endTime ?? "",
        notes: n.notes ?? "",
        recurrenceRule: (n.recurrenceRule as RecurrenceRule) ?? "none",
        recurrenceEndsOn: n.recurrenceEndsOn ?? null,
        recurrenceInterval: n.recurrenceInterval ? Number(n.recurrenceInterval) : 1,
        recurrenceCount: n.recurrenceCount ? Number(n.recurrenceCount) : null,
        eventType: "",
        clientName: "",
        guestCount: "",
        estimatedRevenue: "",
      };
      const blockId = await availRepo.insertBlock(client, session.venueId, input);
      return { ok: true, entityId: blockId };
    }
    if (entityType === "date_hold") {
      const n = record.normalizedPayload as unknown as NormalizedDateHoldLike;
      let leadId = n.leadId ?? "";
      if (!leadId && n.leadEmail) {
        const lead = await resolveLeadIdByEmail(client, session.venueId, null, n.leadEmail);
        if (!lead.ok) return lead;
        leadId = lead.leadId;
      }
      const space = await resolveSpaceId(client, session.venueId, n.spaceId, n.spaceName);
      if (!space.ok) return space;
      const input: DateHoldInput = {
        leadId,
        spaceId: space.spaceId ?? "",
        title: n.title,
        holdDate: n.holdDate,
        startTime: n.startTime ?? "",
        endTime: n.endTime ?? "",
        expiresAt: n.expiresAt ?? "",
        notes: n.notes ?? "",
      };
      const holdId = await availRepo.insertHold(client, session.venueId, input);
      return { ok: true, entityId: holdId };
    }
    if (entityType === "tour") {
      const n = record.normalizedPayload as unknown as NormalizedTourLike;
      const lead = await resolveLeadIdByEmail(client, session.venueId, n.leadId, n.leadEmail);
      if (!lead.ok) return lead;
      const { data, error } = await client.rpc("book_tour_for_migration", {
        p_venue_id: session.venueId,
        p_lead_id: lead.leadId,
        p_slot_start: n.scheduledAt,
        p_notes: n.notes ?? null,
      });
      if (error) return { ok: false, error: occupancyCommitError(error) ?? error.message };
      const d = data as Record<string, unknown>;
      if (!d?.ok) {
        const code = d?.error as string;
        if (code === "slot_taken") {
          return { ok: false, error: "This tour time conflicts with existing capacity or a calendar block. Resolve the conflict, then retry — the booking was not changed." };
        }
        return { ok: false, error: `Could not import tour (${code ?? "unknown"}).` };
      }
      return { ok: true, entityId: d.appointmentId as string };
    }
    if (entityType === "event") {
      const n = record.normalizedPayload as unknown as NormalizedEventLike & { importAsHistoricalRecord?: boolean };
      const asHistorical = !!n.importAsHistoricalRecord && isPastEventDate(n.eventDate);
      const clientRef = await resolveClientIdByEmail(client, session.venueId, n.clientId, n.clientEmail);
      if (!clientRef.ok) return clientRef;
      const requiresSpace = !asHistorical && await venueRequiresEventSpace(client, session.venueId);
      const space = await resolveSpaceId(client, session.venueId, n.spaceId, n.spaceName);
      if (requiresSpace) {
        if (!space.ok) return { ok: false, error: pastConflictForReview(n.eventDate, space.error) };
        if (!space.spaceId) {
          return { ok: false, error: pastConflictForReview(n.eventDate, "Assign an Event Space before importing this dated Event. This venue can host more than one event at the same time.") };
        }
      } else if (!asHistorical && !space.ok) {
        return { ok: false, error: pastConflictForReview(n.eventDate, space.error) };
      }
      const input: EventInput = {
        name: n.name,
        eventType: n.eventType ?? "",
        eventDate: n.eventDate,
        eventEndDate: n.eventEndDate ?? "",
        startTime: n.startTime ?? "",
        endTime: n.endTime ?? "",
        setupTime: n.setupTime ?? "",
        teardownTime: n.teardownTime ?? "",
        guestCount: n.guestCount ?? "",
        clientId: clientRef.clientId,
        spaceId: space.ok ? (space.spaceId ?? "") : "",
      };
      const eventId = await eventsRepo.insertEvent(
        client, session.venueId, input,
        asHistorical ? { status: "complete" } : undefined,
      );
      return { ok: true, entityId: eventId };
    }
    if (entityType === "key_date") {
      const n = record.normalizedPayload as unknown as NormalizedKeyDateLike;
      const clientRef = await resolveClientIdByEmail(client, session.venueId, n.clientId, n.clientEmail);
      if (!clientRef.ok) return clientRef;
      const kd = await clientsRepo.insertKeyDate(client, session.venueId, clientRef.clientId, {
        label: n.label,
        date: n.date,
        note: n.note ?? "",
      });
      return { ok: true, entityId: kd.id };
    }
    return { ok: false, error: `Committing "${entityType}" records isn't supported yet.` };
  } catch (err) {
    const msg = occupancyCommitError(err);
    if (msg) {
      const date = (record.normalizedPayload as { eventDate?: string; eventEndDate?: string } | null)?.eventDate
        ?? (record.normalizedPayload as { holdDate?: string } | null)?.holdDate
        ?? null;
      return { ok: false, error: pastConflictForReview(date, msg) };
    }
    throw err;
  }
}
