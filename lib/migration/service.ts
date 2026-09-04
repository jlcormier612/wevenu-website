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
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
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
import { commitFloorPlanImport } from "@/lib/migration/floor-plan-commit";
import {
  buildNormalizedFloorPlanImport,
  evaluateFloorPlanMatch,
  type FloorPlanMatchCandidate,
} from "@/lib/migration/floor-plan-import";
import {
  canEditFloorPlans,
  FLOOR_PLAN_EDIT_DENIED,
} from "@/lib/floor-plans/authorize";

import * as repo from "@/lib/migration/repository";
import * as documentsRepo from "@/lib/documents/repository";
import { dedupe, findBySourceId } from "@/lib/migration/dedupe";
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
  NormalizedDocumentLike,
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
import {
  commitActiveCommitment,
  type NormalizedActiveCommitment,
} from "@/lib/migration/active-commitment";
import {
  commitOperationalGuest,
  type NormalizedGuestListEntry,
} from "@/lib/migration/operational-guest";
import {
  commitEventVendorAssignmentQuietly,
  type NormalizedEventVendorAssignment,
} from "@/lib/migration/event-vendor-assignment";
import {
  commitOperationalTimelineEntry,
  timelineNotImportedMessage,
  type NormalizedTimelineEntry,
} from "@/lib/migration/operational-timeline";
import type { DocumentCategory } from "@/lib/documents/types";

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

/**
 * In-batch duplicate signal for a row that has no live/committed match
 * (i.e. dedupe() alone would call it "validated"). Mirrors the exact
 * matching signal the live checks already use — email if present,
 * otherwise first+last name (lib/clients/repository.ts's
 * findActiveDuplicateClient / lib/leads/repository.ts's
 * findActiveDuplicate) — for client/lead, and clientEmail/clientId +
 * eventDate for event, since that's the identity an Event resolves
 * against (lib/migration/resolve-refs.ts). No new matching philosophy —
 * same signals, applied against sibling rows in this session instead of
 * the live tables. Returns null when the row doesn't carry enough
 * identity to compare (nothing invented in that case; it's simply not
 * checked in-batch, same as it wouldn't be checked live).
 */
function inBatchDuplicateKey(entityType: MigrationEntityType, normalized: Record<string, unknown>): string | null {
  if (entityType === "client" || entityType === "lead") {
    const n = normalized as NormalizedClientLike;
    const email = n.email?.trim().toLowerCase();
    if (email) return `${entityType}:email:${email}`;
    const first = n.firstName?.trim().toLowerCase();
    const last = n.lastName?.trim().toLowerCase();
    if (first && last) return `${entityType}:name:${first}|${last}`;
    return null;
  }
  if (entityType === "event") {
    const n = normalized as NormalizedEventLike;
    const eventDate = n.eventDate?.trim();
    if (!eventDate) return null;
    const clientKey = n.clientEmail?.trim().toLowerCase() || n.clientId?.trim();
    if (!clientKey) return null;
    return `event:${clientKey}|${eventDate}`;
  }
  return null;
}

export async function runDedupe(client: AnyDbClient, session: MigrationSession): Promise<void> {
  const normalized = await repo.listRecords(client, session.id, "normalized");
  // Claims one in-batch identity key per first-seen row, so later sibling
  // rows (this call, or a later addRows+runDedupe on the same session)
  // with the same signal are flagged against it — surfaced as durable
  // needs-review duplicate_likely, never auto-skipped, since neither row
  // is yet a real canonical record (§ hardening: in-batch duplicates were
  // previously invisible to dedupe, which only ever checked live/committed
  // data). Seeded from every row this session has already validated as a
  // distinct identity (not from duplicate_likely/duplicate_exact/rejected
  // losers — those already independently match a live/earlier record), so
  // re-running dedupe after more rows are added still catches a new row
  // that duplicates an earlier, already-resolved sibling.
  const inBatchClaims = new Map<string, { sourceRowRef: string | null; recordId: string }>();
  const priorValidated = await repo.listRecords(client, session.id, "validated");
  for (const record of priorValidated) {
    if (!record.normalizedPayload) continue;
    const key = inBatchDuplicateKey(record.targetEntityType, record.normalizedPayload);
    if (key && !inBatchClaims.has(key)) {
      inBatchClaims.set(key, { sourceRowRef: record.sourceRowRef, recordId: record.id });
    }
  }
  const floorPlanCatalog = normalized.some((r) => r.targetEntityType === "floor_plan")
    ? await loadFloorPlanMatchCatalog(client, session.venueId)
    : null;

  for (const record of normalized) {
    if (!record.normalizedPayload) continue;

    if (record.targetEntityType === "floor_plan" && floorPlanCatalog) {
      const bySource = await findBySourceId(
        client,
        session.venueId,
        (record.normalizedPayload as { sourceId?: string | null }).sourceId,
      );
      if (bySource?.createdEntityId) {
        await repo.updateRecord(client, record.id, {
          status: "duplicate_exact",
          matchType: "exact",
          matchedEntityId: bySource.createdEntityId,
          matchConfidence: 100,
        });
        continue;
      }
      const built = buildNormalizedFloorPlanImport(
        record.normalizedPayload as Parameters<typeof buildNormalizedFloorPlanImport>[0],
      );
      const outcome = evaluateFloorPlanMatch(built, floorPlanCatalog.spaces, floorPlanCatalog.events);
      const nextPayload = { ...built, ...outcome.patch };
      await repo.updateRecord(client, record.id, {
        status: outcome.status,
        matchType: outcome.matchType,
        matchedEntityId: outcome.matchedEntityId,
        matchConfidence: outcome.matchConfidence,
        normalizedPayload: nextPayload as unknown as Record<string, unknown>,
        validationErrors: outcome.validationErrors,
      });
      continue;
    }

    const result = await dedupe(client, session.venueId, record.targetEntityType, record.normalizedPayload);
    if (result.matchType === "exact") {
      await repo.updateRecord(client, record.id, {
        status: "duplicate_exact", matchType: "exact",
        matchedEntityId: result.matchedEntityId, matchConfidence: result.matchConfidence,
      });
      continue;
    }
    if (result.matchType === "likely") {
      await repo.updateRecord(client, record.id, {
        status: "duplicate_likely", matchType: "likely",
        matchedEntityId: result.matchedEntityId, matchConfidence: result.matchConfidence,
      });
      continue;
    }

    // No live/committed match — before calling it validated, check whether
    // an earlier row in this same batch already claims the same identity.
    // Neither row is a real canonical record yet, so this is never
    // duplicate_exact (which auto-skips at commit) — always a durable,
    // human-reviewed duplicate_likely, pointing back at the earlier row's
    // own source reference so the reviewer can compare both.
    const key = inBatchDuplicateKey(record.targetEntityType, record.normalizedPayload);
    const claim = key ? inBatchClaims.get(key) : undefined;
    if (key && claim) {
      await repo.updateRecord(client, record.id, {
        status: "duplicate_likely", matchType: "likely", matchConfidence: 90,
        validationErrors: [
          `Looks like a duplicate of ${claim.sourceRowRef ?? "another row"} in this same file — review both before importing.`,
        ],
      });
      continue;
    }
    await repo.updateRecord(client, record.id, { status: "validated", matchType: "none" });
    if (key) inBatchClaims.set(key, { sourceRowRef: record.sourceRowRef, recordId: record.id });
  }
  await repo.updateSessionStatus(client, session.id, "ready_for_review");
}

async function loadFloorPlanMatchCatalog(
  client: AnyDbClient,
  venueId: string,
): Promise<{ spaces: FloorPlanMatchCandidate[]; events: FloorPlanMatchCandidate[] }> {
  const [{ data: spaceRows }, { data: eventRows }] = await Promise.all([
    client.from("venue_spaces").select("id, name").eq("venue_id", venueId).order("name"),
    client.from("events").select("id, name, event_date").eq("venue_id", venueId)
      .order("event_date", { ascending: false }).limit(500),
  ]);
  return {
    spaces: ((spaceRows ?? []) as { id: string; name: string }[]).map((s) => ({ id: s.id, name: s.name })),
    events: ((eventRows ?? []) as { id: string; name: string; event_date: string | null }[]).map((e) => ({
      id: e.id, name: e.name, eventDate: e.event_date,
    })),
  };
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
  "document", "active_commitment", "guest_list", "event_vendor_assignment", "timeline_entry",
  "floor_plan",
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

/**
 * Re-attempt one durable unresolved record through the same canonical commit
 * path commitSession itself uses. Availability enforcement is unchanged —
 * success only if the underlying conflict is actually gone. Never invents a
 * placeholder entity and never bypasses a trigger to force a result.
 */
export async function retryOwnRecord(
  sessionId: string, recordId: string,
): Promise<{ ok: true; committed: boolean } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };

  const existing = await repo.getRecord(actor.client, sessionId, recordId);
  if (!existing) return { ok: false, message: "That record is no longer in this migration." };
  if (existing.status === "committed") return { ok: true, committed: true };
  if (existing.status === "rejected" || existing.status === "skipped" || existing.status === "duplicate_exact") {
    return { ok: false, message: "This record was already resolved. It is not waiting for another import attempt." };
  }
  if (!UNRESOLVED_STATUSES.includes(existing.status)) {
    return { ok: false, message: "Only records that still need attention can be retried." };
  }
  if (!existing.normalizedPayload) {
    return { ok: false, message: "This row was never recognized well enough to import. Fix the source file or exclude it intentionally." };
  }

  const record = await repo.claimUnresolvedRecord(actor.client, recordId, actor.createdBy);
  if (!record) {
    return { ok: false, message: "Someone else is already retrying this record. Refresh and try again." };
  }

  const result = await commitOneRecord(actor.client, session, record.targetEntityType, record);
  if (result.ok) {
    await repo.updateRecord(actor.client, record.id, {
      status: "committed",
      createdEntityId: result.entityId,
      committedAt: new Date().toISOString(),
      validationErrors: null,
    });
  } else {
    await repo.updateRecord(actor.client, record.id, {
      status: "needs_review",
      validationErrors: [result.error],
    });
  }
  await repo.releaseClaim(actor.client, record.id);

  const allRecordsAfter = await repo.listRecords(actor.client, session.id);
  const stillUnresolvedAfter = allRecordsAfter.filter((r) => UNRESOLVED_STATUSES.includes(r.status)).length;
  const inFlightAfter = await repo.countInFlightClaims(actor.client, session.id);
  const retryOutcome: CommitOutcome = {
    committed: result.ok ? 1 : 0,
    skipped: 0,
    failed: result.ok ? 0 : 1,
  };
  await repo.updateSessionStatus(
    actor.client,
    session.id,
    computeFinalSessionStatus(retryOutcome, stillUnresolvedAfter + inFlightAfter),
  );
  await repo.touchSession(actor.client, session.id);

  if (!result.ok) return { ok: false, message: result.error };
  return { ok: true, committed: true };
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
  if (entityType === "floor_plan") {
    const role = await getCurrentUserRole();
    if (!canEditFloorPlans(role)) return { ok: false, message: FLOOR_PLAN_EDIT_DENIED };
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
  await reconcileSessionStatusIfSettled(actor.client, session);
  return { ok: true };
}

/**
 * Floor Plan Phase 3 — resolve an ambiguous import: set scope / Space / Event,
 * re-evaluate match, and either validate or keep needs_review.
 */
export async function resolveFloorPlanImportRecord(
  sessionId: string,
  recordId: string,
  patch: {
    scope?: "space_master" | "event_specific" | "general_reference";
    spaceId?: string | null;
    spaceName?: string | null;
    eventId?: string | null;
    eventName?: string | null;
    eventDate?: string | null;
    name?: string | null;
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const role = await getCurrentUserRole();
  if (!canEditFloorPlans(role)) return { ok: false, message: FLOOR_PLAN_EDIT_DENIED };

  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  const records = await repo.listRecords(actor.client, sessionId);
  const record = records.find((r) => r.id === recordId);
  if (!record || record.targetEntityType !== "floor_plan") {
    return { ok: false, message: "Floor plan import record not found." };
  }
  if (!record.normalizedPayload) {
    return { ok: false, message: "Nothing to resolve — this file was never normalized." };
  }

  const merged = buildNormalizedFloorPlanImport({
    ...(record.normalizedPayload as Parameters<typeof buildNormalizedFloorPlanImport>[0]),
    ...patch,
  });
  const catalog = await loadFloorPlanMatchCatalog(actor.client, actor.venueId);
  const outcome = evaluateFloorPlanMatch(merged, catalog.spaces, catalog.events);
  const nextPayload = { ...merged, ...outcome.patch };
  await repo.updateRecord(actor.client, recordId, {
    status: outcome.status === "validated" ? "approved" : "needs_review",
    matchType: outcome.matchType,
    matchedEntityId: outcome.matchedEntityId,
    matchConfidence: outcome.matchConfidence,
    normalizedPayload: nextPayload as unknown as Record<string, unknown>,
    validationErrors: outcome.validationErrors,
    reviewedBy: actor.createdBy ?? undefined,
    reviewedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export async function getFloorPlanImportCatalog(): Promise<{
  spaces: FloorPlanMatchCandidate[];
  events: FloorPlanMatchCandidate[];
}> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return { spaces: [], events: [] };
  return loadFloorPlanMatchCatalog(actor.client, actor.venueId);
}

export async function commitOwnSession(sessionId: string): Promise<{ ok: true; outcome: CommitOutcome } | { ok: false; message: string }> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return actor;
  const session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  const summary = await getSessionSummary(actor.client, session);
  if (summary.byEntityType.floor_plan) {
    const role = await getCurrentUserRole();
    if (!canEditFloorPlans(role)) return { ok: false, message: FLOOR_PLAN_EDIT_DENIED };
  }
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

/**
 * When every record is settled (imported, already-in-HTC, or intentionally
 * excluded) without a commit pass, History still keyed off session.status
 * and could show “Needs your attention”. Advance to committed so the list
 * badge matches the resume “Complete” truth — including exclusion-only
 * sessions where nothing was imported.
 */
export async function reconcileSessionStatusIfSettled(
  client: AnyDbClient,
  session: MigrationSession,
): Promise<MigrationSession> {
  if (session.status === "abandoned" || session.status === "failed" || session.status === "committed") {
    return session;
  }
  const summary = await getSessionSummary(client, session);
  if (computeSessionResumeState(summary.counts) !== "done") return session;
  await repo.updateSessionStatus(client, session.id, "committed");
  return { ...session, status: "committed" };
}

export async function getOwnSessionResumeState(sessionId: string): Promise<{ state: SessionResumeState; summary: SessionSummary } | null> {
  const actor = await resolveVenueActor();
  if (isError(actor)) return null;
  let session = await repo.getSession(actor.client, actor.venueId, sessionId);
  if (!session) return null;
  session = await reconcileSessionStatusIfSettled(actor.client, session);
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
    if (entityType === "document") {
      const n = record.normalizedPayload as unknown as NormalizedDocumentLike;
      const entityScope = n.entityType === "client" ? "client" : "event";
      let entityId = n.eventId ?? "";
      let clientId: string | null = null;
      if (entityScope === "client" || !entityId) {
        const clientRef = await resolveClientIdByEmail(client, session.venueId, n.clientId, n.clientEmail);
        if (!clientRef.ok) return clientRef;
        clientId = clientRef.clientId;
      }
      if (entityScope === "event") {
        if (!entityId) {
          if (!n.eventDate || !clientId) {
            return { ok: false, error: "Event documents need eventId, or client email plus eventDate." };
          }
          const { data: events, error } = await client.from("events")
            .select("id")
            .eq("venue_id", session.venueId)
            .eq("client_id", clientId)
            .eq("event_date", n.eventDate)
            .limit(2);
          if (error) throw error;
          if (!events?.length) return { ok: false, error: "No Event found for that client and date." };
          if (events.length > 1) return { ok: false, error: "Multiple Events match — set eventId explicitly." };
          entityId = (events[0] as { id: string }).id;
        }
      } else {
        entityId = clientId!;
      }
      const documentId = await documentsRepo.insertDocument(client, session.venueId, {
        entityType: entityScope,
        entityId,
        name: n.name || n.fileName,
        fileName: n.fileName,
        fileSize: n.fileSize ? Number(n.fileSize) : 0,
        mimeType: n.mimeType ?? "application/octet-stream",
        storagePath: n.storagePath,
        storageUrl: n.storageUrl,
        category: (n.category as DocumentCategory) || "other",
        notes: n.notes?.trim()
          || "Imported via Bring Your Business — real HTC document on this record.",
        tags: "migration",
        expiresAt: "",
      });
      return { ok: true, entityId: documentId };
    }
    if (entityType === "active_commitment") {
      const n = record.normalizedPayload as unknown as NormalizedActiveCommitment;
      const result = await commitActiveCommitment(client, session.venueId, n);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, entityId: result.eventId };
    }
    if (entityType === "guest_list") {
      const n = record.normalizedPayload as unknown as NormalizedGuestListEntry;
      const result = await commitOperationalGuest(client, session.venueId, n);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, entityId: result.guestId };
    }
    if (entityType === "event_vendor_assignment") {
      const n = record.normalizedPayload as unknown as NormalizedEventVendorAssignment;
      const result = await commitEventVendorAssignmentQuietly(client, session.venueId, n);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, entityId: result.assignmentId };
    }
    if (entityType === "timeline_entry") {
      const n = record.normalizedPayload as unknown as NormalizedTimelineEntry;
      const result = await commitOperationalTimelineEntry(client, session.venueId, n);
      if (!result.ok) return { ok: false, error: result.error };
      if (result.skipped) {
        return {
          ok: false,
          error: timelineNotImportedMessage(result.skipReason ?? "This timeline wasn't brought over yet."),
        };
      }
      return { ok: true, entityId: result.entryId! };
    }
    if (entityType === "floor_plan") {
      return commitFloorPlanImport(client, session.venueId, record.normalizedPayload ?? {});
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
