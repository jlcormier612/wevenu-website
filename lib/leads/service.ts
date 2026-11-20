/**
 * Leads application service.
 * Orchestrates auth, venue lookup, validation, and persistence.
 * Components and server actions call here — never the repository directly.
 * Server-only.
 */
import { cache } from "react";
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/leads/repository";
import {
  buildEventTypeCounts,
  buildStatusCounts,
  filterLeadsForList,
  nextProgressiveWindow,
  sliceLeadWindow,
  LEADS_PAGE_SIZE,
  type LeadsListPageResult,
  type LeadsListParams,
  type LeadsListSort,
  type LeadsListAttention,
} from "@/lib/leads/list-query";
import { LeadTourWriteError, TOUR_TIME_REQUIRED } from "@/lib/leads/relationship-tour";
import { requireAdminUser } from "@/lib/hq/crm-service";
import type {
  CreateLeadResult,
  Lead,
  LeadActionResult,
  LeadInput,
  LeadWithDetails,
  RelationshipInput,
  TaskInput,
} from "@/lib/leads/types";
import {
  followUpCompletedTitle,
  resolveFollowUpCompletion,
  type FollowUpCompletionInput,
} from "@/lib/leads/follow-up-completion";
import {
  validateLeadInput,
  validateStatus,
  validateTaskInput,
} from "@/lib/leads/validation";
import { parseMoneyInput } from "@/lib/leads/constants";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  importFingerprintFromData,
  sourceRecordIdFromData,
  type ImportMatchRecord,
} from "@/lib/import/venue-controlled-match";

function estimatedBudgetFromInput(raw: string | null | undefined): number | null {
  const parsed = parseMoneyInput(raw ?? "");
  if (!parsed) return null;
  const n = Number(parsed);
  return Number.isFinite(n) ? n : null;
}
import { exitActiveEnrollmentsForRelationship } from "@/lib/message-sequences/repository";
import {
  triggerSequencesForRelationship,
  wouldEnrollOnStageChange,
} from "@/lib/message-sequences/service";
import {
  CANCELLED_RELATIONSHIP_STAGE,
  isForwardSalesStageMove,
  isManuallyAssignableSalesStage,
  isSalesStage,
  SALES_PIPELINE_RETURN_STAGE,
  type SalesStage,
} from "@/lib/leads/sales-stages";
import { ingestLead } from "@/lib/lead-intake/pipeline";
import type { RawIntakeInput, TrustTier } from "@/lib/lead-intake/types";
import { originAfterStaffEdit, originForWritePath } from "@/lib/leads/inquiry-message-origin";
import {
  previewStepsForSequence,
  type AutomationMessagePreview,
  type StageChangeMessagePlan,
} from "@/lib/message-sequences/confirm-preview";
import { requireIdentityDecision } from "@/lib/identity/decision";

/** Shared auth + venue guard. Returns a typed error if anything is missing. */
async function withVenue<T>(
  fn: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
  ) => Promise<T>,
): Promise<T | LeadActionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue)
    return { ok: false, message: "No venue found. Complete setup first." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, message: "Session expired. Please sign in again." };
  return fn(supabase, venue.id);
}

// ---- read -------------------------------------------------------------------

export async function getLeads(filters?: { q?: string; status?: string }): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return repo.getLeads(supabase, venue.id, filters);
}

export type { LeadsListPageResult, LeadsListParams };

/**
 * Live Leads list window (Wave 1 path).
 * Hot-path RPCs stay off this path: query gates passed, but browser remasure
 * after wire (`fbc175f4`) did not beat Wave 1 Filter — live list rolled back.
 */
export async function getLeadsListPage(
  params: LeadsListParams = {},
): Promise<LeadsListPageResult> {
  const pageSize = params.pageSize ?? LEADS_PAGE_SIZE;
  const empty: LeadsListPageResult = {
    leads: [],
    totalLeads: 0,
    totalMatching: 0,
    offset: 0,
    pageSize,
    hasMore: false,
    page: 1,
    totalPages: 1,
    statusCounts: { all: 0, booked: params.currentBookedCount ?? 0, lost: 0 },
    eventTypeCounts: [],
    indexTruncated: false,
    indexError: null,
    params: {
      q: params.q ?? "",
      status: params.status ?? (params.outcome === "lost" ? "lost" : "all"),
      eventType: params.eventType ?? "all",
      sort: (params.sort ?? "newest") as LeadsListSort,
      attention: (params.attention ?? "all") as LeadsListAttention,
      outcome: params.outcome ?? "active",
      offset: 0,
    },
  };
  if (!isSupabaseConfigured) return empty;
  const venue = await getCurrentVenue();
  if (!venue) return empty;
  const supabase = await createClient();
  const indexResult = await repo.getLeadsListIndex(supabase, venue.id);
  if (indexResult.truncated) {
    return {
      ...empty,
      indexTruncated: true,
      indexError: repo.LEADS_LIST_INDEX_TRUNCATED_MESSAGE,
    };
  }
  const index = indexResult.leads;
  const outcome = params.outcome ?? "active";
  const status = params.status ?? (outcome === "lost" ? "lost" : "all");
  const attention = (params.attention ?? "all") as LeadsListAttention;
  const eventType = params.eventType ?? "all";
  const sort = (params.sort ?? "newest") as LeadsListSort;
  const q = params.q ?? "";
  const currentBookedCount = params.currentBookedCount ?? 0;
  const offset =
    params.offset != null
      ? params.offset
      : params.page != null
        ? Math.max(0, (params.page - 1) * pageSize)
        : 0;

  const statusCountsMap = buildStatusCounts(index, currentBookedCount);
  const statusCounts: Record<string, number> = Object.fromEntries(statusCountsMap);
  const eventTypeCounts = buildEventTypeCounts(index);

  const filtered = filterLeadsForList(index, {
    ...params,
    status,
    attention,
    eventType,
    sort,
    outcome,
    q,
  });

  const excludeIds = params.excludeIds ?? [];
  const windowed =
    excludeIds.length > 0
      ? (() => {
          const progressive = nextProgressiveWindow(filtered, excludeIds, pageSize);
          return {
            pageItems: progressive.pageItems,
            offset: 0,
            pageSize: progressive.pageSize,
            totalMatching: progressive.totalMatching,
            hasMore: progressive.hasMore,
          };
        })()
      : sliceLeadWindow(filtered, offset, pageSize);
  const totalPages = Math.max(1, Math.ceil(windowed.totalMatching / pageSize) || 1);

  return {
    leads: windowed.pageItems,
    totalLeads: index.length,
    totalMatching: windowed.totalMatching,
    offset: windowed.offset,
    pageSize: windowed.pageSize,
    hasMore: windowed.hasMore,
    page: Math.floor(windowed.offset / pageSize) + 1,
    totalPages,
    statusCounts,
    eventTypeCounts,
    indexTruncated: false,
    indexError: null,
    params: {
      q,
      status,
      eventType,
      sort,
      attention,
      outcome,
      offset: windowed.offset,
    },
  };
}

/**
 * Migration Center §2.1 item 3 (2026-07-22) — the same email-then-name
 * matching findActiveDuplicate() uses against the database, as an in-memory
 * key an import loop can check two CSV rows against each other with,
 * before either ever reaches the database. Case-insensitive, trimmed, to
 * match the DB check's `ilike` semantics exactly.
 */
export function leadIdentityKey(email: string | null | undefined, firstName: string, lastName: string): string {
  const trimmedEmail = (email ?? "").trim().toLowerCase();
  return trimmedEmail || `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

/** Import-loop → Lead Intake pipeline shape. Only the fields logDuplicateBatchRejection's normalizer actually reads matter here — same field set createLeadCore already threads into ingestLead's own `input`. */
export function leadInputToRawIntake(input: LeadInput): RawIntakeInput {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    partnerFirstName: input.partnerFirstName,
    partnerLastName: input.partnerLastName,
    partnerEmail: input.partnerEmail,
    eventType: input.eventType,
    eventDate: input.eventDate,
    endDate: input.endDate,
    guestCount: input.guestCount ? parseInt(input.guestCount, 10) || null : null,
    estimatedBudget: estimatedBudgetFromInput(input.estimatedBudget),
    inquiryMessage: input.inquiryMessage,
    inquiryDate: input.inquiryDate,
  };
}

/** An already-active Lead matching this email (or, absent an email, this exact name) — for import-time duplicate detection. Null if the venue can't be resolved, matching this module's other read functions' fail-open shape. */
export async function findActiveDuplicateLead(email: string, firstName: string, lastName: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.findActiveDuplicate(supabase, venue.id, email, firstName, lastName);
}

/** White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see createClientForVenue's doc comment (lib/clients/service.ts) for the pattern this mirrors. */
export async function findActiveDuplicateLeadForVenue(venueId: string, email: string, firstName: string, lastName: string): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  const actor = await requireAdminUser();
  if (!actor) return null;
  return repo.findActiveDuplicate(createAdminClient(), venueId, email, firstName, lastName);
}

function inquiryIdentityFromRow(row: repo.ActiveLeadInquiryRow) {
  const sourceData = row.sourceData ?? {};
  return {
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    eventDate: row.eventDate,
    partnerFirstName: row.partnerFirstName,
    partnerLastName: row.partnerLastName,
    eventType: row.eventType,
    guestCount: row.guestCount,
    source: row.source,
    originalSourceLabel: typeof sourceData.original_source_label === "string" ? sourceData.original_source_label : "",
    inquiryMessage: row.inquiryMessage,
    followUpDate: row.followUpDate,
    nextActionText: row.nextActionText,
    dateFlexibility: typeof sourceData.date_flexibility === "string" ? sourceData.date_flexibility : "",
    salesStage: row.salesStage,
  };
}

async function matchIncomingLeadWithClient(
  supabase: Parameters<typeof repo.findActiveLeadByEmail>[0],
  venueId: string,
  incoming: {
    firstName: string;
    lastName: string;
    email?: string | null;
    eventDate?: string | null;
    partnerFirstName?: string | null;
    partnerLastName?: string | null;
    eventType?: string | null;
    guestCount?: string | number | null;
    source?: string | null;
    originalSourceLabel?: string | null;
    inquiryMessage?: string | null;
    followUpDate?: string | null;
    nextActionText?: string | null;
    dateFlexibility?: string | null;
    salesStage?: string | null;
  },
) {
  const { classifyPersonMatch } = await import("@/lib/import/match-policy");
  const { classifyLeadImportMatch } = await import("@/lib/import/inquiry-identity");
  const byEmail = await repo.findActiveLeadByEmail(supabase, venueId, incoming.email ?? "");
  const byName = await repo.findActiveLeadByName(supabase, venueId, incoming.firstName, incoming.lastName);
  const person = classifyPersonMatch(incoming, byEmail, byName);
  const emailInquiries = await repo.listActiveLeadsByEmail(supabase, venueId, incoming.email ?? "");
  const existingInquiries = emailInquiries.map(inquiryIdentityFromRow);
  const matched = byEmail?.id === person.matchedId ? byEmail : byName?.id === person.matchedId ? byName : null;
  return {
    ...classifyLeadImportMatch(person, incoming, existingInquiries),
    matchedEventDate: matched?.eventDate ?? null,
    existingInquiries,
  };
}

export async function matchIncomingLead(incoming: {
  firstName: string;
  lastName: string;
  email?: string | null;
  eventDate?: string | null;
  partnerFirstName?: string | null;
  partnerLastName?: string | null;
  eventType?: string | null;
  guestCount?: string | number | null;
  source?: string | null;
  originalSourceLabel?: string | null;
  inquiryMessage?: string | null;
  followUpDate?: string | null;
  nextActionText?: string | null;
  dateFlexibility?: string | null;
  salesStage?: string | null;
}) {
  const { classifyPersonMatch } = await import("@/lib/import/match-policy");
  const { classifyLeadImportMatch } = await import("@/lib/import/inquiry-identity");
  const empty = {
    ...classifyLeadImportMatch(classifyPersonMatch(incoming, null, null), incoming, []),
    matchedEventDate: null as string | null,
    existingInquiries: [] as ReturnType<typeof inquiryIdentityFromRow>[],
  };
  if (!isSupabaseConfigured) return empty;
  const venue = await getCurrentVenue();
  if (!venue) return empty;
  const supabase = await createClient();
  return matchIncomingLeadWithClient(supabase, venue.id, incoming);
}

function importMatchRecordFromLead(row: repo.ImportMatchLeadRow): ImportMatchRecord {
  return {
    leadId: row.id,
    clientId: null,
    relationshipId: row.relationshipId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    partnerFirstName: row.partnerFirstName,
    partnerLastName: row.partnerLastName,
    partnerEmail: row.partnerEmail,
    inquiryMessage: row.inquiryMessage,
    eventDate: row.eventDate,
    eventType: row.eventType,
    salesStage: row.salesStage,
    guestCount: row.guestCount,
    source: row.source,
    followUpDate: row.followUpDate,
    nextActionText: row.nextActionText,
    estimatedBudget: row.estimatedBudget,
    sourceRecordId: sourceRecordIdFromData(row.sourceData),
    importFingerprint: importFingerprintFromData(row.sourceData),
  };
}

async function listImportMatchRecordsWithClient(
  supabase: Parameters<typeof repo.listImportMatchLeads>[0],
  venueId: string,
) {
  const leads = await repo.listImportMatchLeads(supabase, venueId);
  const records = leads.map(importMatchRecordFromLead);
  const { data: clients } = await supabase.from("clients").select(
    "id, lead_id, relationship_id, first_name, last_name, email, phone, partner_first_name, partner_last_name, partner_email, event_date, event_type, status, guest_count",
  ).eq("venue_id", venueId);
  for (const row of clients ?? []) {
    const r = row as {
      id: string;
      lead_id: string | null;
      relationship_id: string | null;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      partner_first_name: string | null;
      partner_last_name: string | null;
      partner_email: string | null;
      event_date: string | null;
      event_type: string | null;
      status: string | null;
      guest_count: number | null;
    };
    if (r.lead_id && records.some((existing) => existing.leadId === r.lead_id)) {
      const existing = records.find((item) => item.leadId === r.lead_id);
      if (existing && !existing.clientId) existing.clientId = r.id;
      continue;
    }
    records.push({
      leadId: r.lead_id,
      clientId: r.id,
      relationshipId: r.relationship_id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      partnerFirstName: r.partner_first_name,
      partnerLastName: r.partner_last_name,
      partnerEmail: r.partner_email,
      inquiryMessage: null,
      eventDate: r.event_date,
      eventType: r.event_type,
      salesStage: r.status,
      guestCount: r.guest_count,
      source: null,
      followUpDate: null,
      nextActionText: null,
      estimatedBudget: null,
      sourceRecordId: null,
      importFingerprint: null,
    });
  }
  return records;
}

export async function listImportMatchRecords() {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return listImportMatchRecordsWithClient(supabase, venue.id);
}

export async function listImportMatchRecordsForVenue(venueId: string) {
  const actor = await requireAdminUser();
  if (!actor) return [];
  return listImportMatchRecordsWithClient(createAdminClient(), venueId);
}

/** White-Glove match — same inquiry identity and retry policy as self-service. */
export async function matchIncomingLeadForVenue(
  venueId: string,
  incoming: {
    firstName: string;
    lastName: string;
    email?: string | null;
    eventDate?: string | null;
    partnerFirstName?: string | null;
    partnerLastName?: string | null;
    eventType?: string | null;
    guestCount?: string | number | null;
    source?: string | null;
    originalSourceLabel?: string | null;
    inquiryMessage?: string | null;
    followUpDate?: string | null;
    nextActionText?: string | null;
    dateFlexibility?: string | null;
    salesStage?: string | null;
  },
) {
  const { classifyPersonMatch } = await import("@/lib/import/match-policy");
  const { classifyLeadImportMatch } = await import("@/lib/import/inquiry-identity");
  const empty = {
    ...classifyLeadImportMatch(classifyPersonMatch(incoming, null, null), incoming, []),
    matchedEventDate: null as string | null,
    existingInquiries: [] as ReturnType<typeof inquiryIdentityFromRow>[],
  };
  if (!isSupabaseConfigured) return empty;
  const actor = await requireAdminUser();
  if (!actor) return empty;
  return matchIncomingLeadWithClient(createAdminClient(), venueId, incoming);
}

/**
 * Request-scoped only (`cache`) — dedupes generateMetadata + page + same-request
 * authz helpers. Never cross-request / cross-tenant.
 */
export const getLead = cache(async function getLead(leadId: string): Promise<LeadWithDetails | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  return repo.getLead(supabase, venue.id, leadId);
});

// ---- create -----------------------------------------------------------------

/**
 * The real create-a-lead logic, independent of how `venueId` was resolved.
 * Extracted so White-Glove imports (`createLeadForVenue`, Hospitality
 * Success Platform §2.2a) run through the exact same Lead Intake pipeline
 * self-service does. See createClientCore's doc comment for the pattern.
 */
async function createLeadCore(
  supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, input: LeadInput, trustTier: TrustTier,
  historicalImport = false,
): Promise<CreateLeadResult> {
  // Manual / ordinary new Lead: venue accepted inquiry types are required.
  // Historical import (Migration Center / White-Glove) may carry legacy types.
  if (!historicalImport) {
    const { data: venueRow } = await supabase
      .from("venues")
      .select("accepted_inquiry_event_types")
      .eq("id", venueId)
      .maybeSingle<{ accepted_inquiry_event_types: unknown }>();
    const { assertEventTypeAcceptedForNewRecord } = await import(
      "@/lib/event-types/assert-accepted"
    );
    const accepted = assertEventTypeAcceptedForNewRecord(
      input.eventType,
      venueRow?.accepted_inquiry_event_types,
    );
    if (!accepted.ok) {
      return {
        ok: false,
        errors: { eventType: accepted.error },
        message: accepted.error,
      };
    }
  }

  if (trustTier === "manual" && !historicalImport) {
    const { findPossibleDuplicateMatches } = await import("@/lib/leads/duplicate-detection");
    const matches = await findPossibleDuplicateMatches(supabase, venueId, {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      partnerFirstName: input.partnerFirstName,
      partnerLastName: input.partnerLastName,
      partnerEmail: input.partnerEmail,
    });
    const decided = requireIdentityDecision(matches, input.identityDecision);
    if (!decided.ok) {
      return {
        ok: false,
        code: "identity_review_required",
        matches: decided.matches,
        message: "We may already have this customer.",
      };
    }
  }

  // Routed through the Lead Intake pipeline (Log Attempt → Relationship
  // Resolution → Lead Creation → Automation Trigger → Assignment Hook) —
  // manual entry and CSV import are just another Source Adapter now, not
  // a separate implementation. Activity is logged by the DB trigger
  // (log_lead_created), same as every other source.
  const outcome = await ingestLead({
    supabase,
    venueId,
    source: input.source || "other",
    trustTier,
    historicalImport,
    rawPayload: input,
    input: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      partnerFirstName: input.partnerFirstName,
      partnerLastName: input.partnerLastName,
      partnerEmail: input.partnerEmail,
      eventType: input.eventType,
      eventDate: input.eventDate,
      endDate: input.endDate,
      guestCount: input.guestCount ? parseInt(input.guestCount, 10) || null : null,
      estimatedBudget: estimatedBudgetFromInput(input.estimatedBudget),
      inquiryMessage: input.inquiryMessage,
      inquiryDate: input.inquiryDate,
      sourceData: input.originalSourceLabel ? { original_source_label: input.originalSourceLabel } : undefined,
    },
    create: async () => {
      try {
        const inquiryMessageOrigin = historicalImport || trustTier === "import"
          ? originForWritePath("import")
          : originForWritePath("manual_new_lead");
        const leadId = await repo.insertLead(
          supabase,
          venueId,
          { ...input, inquiryMessageOrigin },
          historicalImport,
        );
        const { data: lead } = await supabase.from("leads").select("relationship_id")
          .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
        if (!lead?.relationship_id) return { ok: false, error: "Lead created without a relationship." };
        const { count } = await supabase.from("leads")
          .select("id", { count: "exact", head: true })
          .eq("relationship_id", lead.relationship_id);
        return { ok: true, leadId, relationshipId: lead.relationship_id, isReturningRelationship: (count ?? 0) > 1 };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Could not create lead." };
      }
    },
  });

  if (!outcome.ok) return { ok: false, message: outcome.error };
  try {
    await applyImportedLeadDetails(supabase, venueId, outcome.leadId, input);
  } catch (err) {
    console.error("Imported lead details could not be saved:", err);
  }
  return { ok: true, leadId: outcome.leadId, relationshipId: outcome.relationshipId };
}

/** Follow-up, notes, and pipeline status after a quiet Lead create. Never books. */
async function applyImportedLeadDetails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadId: string,
  input: LeadInput,
): Promise<void> {
  const noteParts: string[] = [];
  if (input.dateFlexibility?.trim()) {
    noteParts.push(`Date flexibility: ${input.dateFlexibility.trim()}`);
  }
  if (noteParts.length > 0) {
    await repo.insertNote(supabase, venueId, leadId, noteParts.join("\n"));
  }
  if (input.followUpDate?.trim() || input.nextActionText?.trim() || input.nextActionDue?.trim()) {
    await repo.updateRelationshipFields(supabase, venueId, leadId, {
      nextActionText: input.nextActionText ?? "",
      nextActionDue: input.nextActionDue ?? "",
      followUpDate: input.followUpDate ?? "",
      lastContactedAt: "",
      tourDate: "",
      tourTime: "",
      tourCompleted: false,
      tourNotes: "",
      tourActualDate: "",
      tourActualTime: "",
    });
  }
  const { parseImportedLeadSalesStage } = await import("@/lib/import/lead-import");
  const parsed = parseImportedLeadSalesStage(input.salesStage);
  if (parsed.kind === "stage") {
    const lost = parsed.stage === "lost"
      ? { reason: "other" as const, detail: "Imported historical status" }
      : undefined;
    await repo.updateLeadSalesStage(
      supabase,
      venueId,
      leadId,
      parsed.stage,
      undefined,
      lost,
    );
  } else if (parsed.kind === "tour" || parsed.kind === "unknown") {
    const raw = parsed.kind === "unknown" ? parsed.raw : "tour scheduled";
    await repo.insertNote(
      supabase,
      venueId,
      leadId,
      `Imported status “${raw}” was saved as a note. Tours are imported separately and this Lead was not marked Booked.`,
    );
  }
}

/**
 * `trustTier` defaults to "manual" (the single-lead-add form's own use)
 * but the CSV import actions pass "import" explicitly — Migration Center
 * §2.1 item 3 (2026-07-22): TrustTier already had a real "import" value
 * defined, but every import-created lead was silently mislabeled "manual"
 * since this always hardcoded that value regardless of caller.
 */
export async function createLead(
  input: LeadInput, trustTier: TrustTier = "manual", historicalImport = false,
): Promise<CreateLeadResult> {
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue((supabase, venueId) => createLeadCore(supabase, venueId, input, trustTier, historicalImport));
  return result as CreateLeadResult;
}

/**
 * White-Glove Migration (Hospitality Success Platform §2.2a step 4) — see
 * createClientForVenue's doc comment for the pattern this mirrors. Always
 * an import, so trustTier is fixed at "import", not a parameter.
 * `historicalImport` (Migration Center) defaults true here — an admin
 * importing on a venue's behalf is migrating backfilled data far more often
 * than not; a genuinely current lead a specialist enters live should pass
 * `false` explicitly.
 */
export async function createLeadForVenue(venueId: string, input: LeadInput, historicalImport = true): Promise<CreateLeadResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const admin = createAdminClient();
  return createLeadCore(admin, venueId, input, "import", historicalImport);
}

// ---- update sales stage -----------------------------------------------------

export async function updateLeadSalesStage(
  leadId: string,
  stage: string,
  opts?: {
    clientId?: string | null;
    /** Required to leave Booked for a non-Lost sales-pipeline stage (Move back to Sales Pipeline). */
    allowLeaveBooked?: boolean;
    /** Venue pipeline stage id to store alongside sales_stage (custom pipelines). */
    pipelineStageId?: string | null;
    /** Required when stage is lost — structured reason + optional detail. */
    lost?: { reason: string; detail: string | null } | null;
    /**
     * Set only by the stage-change confirmation.
     * send schedules matching messages; skip records them cancelled for this attempt.
     * Omitted callers keep the existing fire-and-forget enrollment.
     */
    customerMessages?: "send" | "skip";
  },
): Promise<LeadActionResult> {
  if (!validateStatus(stage) || !isSalesStage(stage))
    return { ok: false, message: `"${stage}" is not a valid sales stage.` };
  if (stage === "booked") {
    return { ok: false, message: "Move to Booked requires confirmation — use Confirm Booked move." };
  }
  if (!isManuallyAssignableSalesStage(stage)) {
    return { ok: false, message: "That stage cannot be set manually." };
  }
  if (stage === "lost") {
    const { validateLostReasonInput, isLostReasonValue } = await import("@/lib/leads/lost-reasons");
    if (!opts?.lost || !isLostReasonValue(opts.lost.reason)) {
      return { ok: false, message: "Marking a lead Lost requires a lost reason." };
    }
    const lostErr = validateLostReasonInput({
      reason: opts.lost.reason,
      detail: opts.lost.detail,
    });
    if (lostErr) return { ok: false, message: lostErr };
  }

  const result = await withVenue(async (supabase, venueId) => {
    const { data: before } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    const previousStage = before?.sales_stage ?? null;

    // Leaving Booked for an active sales stage requires the deliberate Move Back path.
    // Lost remains available from Booked (deal died after booking).
    if (
      previousStage === "booked"
      && stage !== "lost"
      && !opts?.allowLeaveBooked
    ) {
      return {
        ok: false,
        message: "Use Move back to Sales Pipeline to leave Booked.",
      } as LeadActionResult;
    }

    await repo.updateLeadSalesStage(
      supabase,
      venueId,
      leadId,
      stage,
      opts?.pipelineStageId !== undefined ? opts.pipelineStageId : undefined,
      stage === "lost" && opts?.lost
        ? { reason: opts.lost.reason, detail: opts.lost.detail }
        : stage === "lost"
          ? null
          : undefined,
    );

    const { data: lead } = await supabase.from("leads").select("relationship_id")
      .eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
    if (lead?.relationship_id) {
      if (stage === "lost") {
        try {
          await exitActiveEnrollmentsForRelationship(
            supabase, venueId, lead.relationship_id, "exited_lost",
          );
        } catch (e) {
          console.error("Series exit (exited_lost) failed:", e);
        }
      }
      const customerMessages = opts?.customerMessages;
      if (customerMessages === "send" || customerMessages === "skip") {
        try {
          const enrollmentIds = await triggerSequencesForRelationship(
            supabase, venueId, lead.relationship_id, "lead_stage_changed", stage,
            { customerMessages },
          );
          if (customerMessages === "skip" && enrollmentIds.length > 0) {
            await repo.insertActivity(
              supabase,
              venueId,
              leadId,
              "automation_skipped",
              "Automation messages not sent",
              "This stage change continued without sending the matching automation messages. The saved automation was not changed.",
            );
          }
        } catch (e) {
          console.error("Series enrollment (lead_stage_changed) failed:", e);
          return {
            ok: true,
            automationWarning: "The stage was updated, but the automation did not finish. Check scheduled messages before assuming one will send.",
          } as LeadActionResult;
        }
      } else {
        void triggerSequencesForRelationship(supabase, venueId, lead.relationship_id, "lead_stage_changed", stage)
          .catch((e) => console.error("Series enrollment (lead_stage_changed) failed:", e));
      }
    }

    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

/** @deprecated Prefer updateLeadSalesStage */
export async function updateLeadStatus(
  leadId: string,
  status: string,
  opts?: { customerMessages?: "send" | "skip" },
): Promise<LeadActionResult> {
  return updateLeadSalesStage(leadId, status, opts);
}

/**
 * Forward-only auto stage advance (tour booked, sequence enroll, etc.).
 * Never moves backward; never overrides Booked/Lost.
 * Booked is structurally excluded — only bookClient / book_relationship
 * may write sales_stage booked.
 */
export async function advanceLeadSalesStageIfForward(
  leadId: string,
  target: Exclude<SalesStage, "booked">,
): Promise<LeadActionResult> {
  if ((target as SalesStage) === "booked") {
    return { ok: false, message: "Booked requires the canonical booking operation." };
  }
  const result = await withVenue(async (supabase, venueId) => {
    const { data: row } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (!row?.sales_stage || !isSalesStage(row.sales_stage)) {
      return { ok: false, message: "Lead not found." } as LeadActionResult;
    }
    if (!isForwardSalesStageMove(row.sales_stage, target)) {
      return { ok: true } as LeadActionResult;
    }
    return updateLeadSalesStage(leadId, target);
  });
  return result as LeadActionResult;
}

/** Board / detail: move to a venue pipeline stage id, or a sales_stage key when no custom template is active. */
export async function updateLeadPipelineStage(
  leadId: string,
  stageKeyOrId: string,
  opts?: { customerMessages?: "send" | "skip" },
): Promise<LeadActionResult> {
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageKeyOrId);

  if (looksLikeUuid) {
    const result = await withVenue(async (supabase, venueId) => {
      const { data: stage, error } = await supabase
        .from("pipeline_stages")
        .select("id, canonical_stage, pipeline_template_id")
        .eq("id", stageKeyOrId)
        .eq("venue_id", venueId)
        .maybeSingle<{ id: string; canonical_stage: string; pipeline_template_id: string }>();
      if (error) throw error;
      if (!stage) return { ok: false, message: "That pipeline stage was not found." } as LeadActionResult;

      const { data: tpl } = await supabase
        .from("pipeline_templates")
        .select("id, is_active")
        .eq("id", stage.pipeline_template_id)
        .eq("venue_id", venueId)
        .maybeSingle<{ id: string; is_active: boolean }>();
      if (!tpl?.is_active) {
        return { ok: false, message: "That stage is not on the active pipeline." } as LeadActionResult;
      }

      const { salesStageForCanonical } = await import("@/lib/pipeline-templates/sales-stage-bridge");
      const { isCanonicalStage } = await import("@/lib/pipeline-templates/types");
      const { transitionKindForCanonical } = await import("@/lib/leads/pipeline-stage-transition");
      if (!isCanonicalStage(stage.canonical_stage)) {
        return { ok: false, message: "That stage has an invalid reporting category." } as LeadActionResult;
      }
      const kind = transitionKindForCanonical(stage.canonical_stage);
      if (kind === "booked") {
        return {
          ok: false,
          message: "Moving to Booked requires confirmation — use Confirm Booked move.",
        } as LeadActionResult;
      }
      if (kind === "lost") {
        return {
          ok: false,
          message: "Marking a lead Lost requires a lost reason.",
        } as LeadActionResult;
      }
      const { data: currentLead } = await supabase
        .from("leads")
        .select("sales_stage")
        .eq("id", leadId)
        .eq("venue_id", venueId)
        .maybeSingle<{ sales_stage: string | null }>();
      const fallback = currentLead?.sales_stage && isSalesStage(currentLead.sales_stage)
        ? currentLead.sales_stage
        : "new_inquiry";
      const salesStage = salesStageForCanonical(stage.canonical_stage, fallback);
      return updateLeadSalesStage(leadId, salesStage, {
        pipelineStageId: stage.id,
        customerMessages: opts?.customerMessages,
      });
    });
    return result as LeadActionResult;
  }

  const { transitionKindForSalesStageKey } = await import("@/lib/leads/pipeline-stage-transition");
  const kind = transitionKindForSalesStageKey(stageKeyOrId);
  if (kind === "booked") {
    return { ok: false, message: "Moving to Booked requires confirmation — use Confirm Booked move." };
  }
  if (kind === "lost") {
    return { ok: false, message: "Marking a lead Lost requires a lost reason." };
  }
  return updateLeadSalesStage(leadId, stageKeyOrId, opts);
}

/**
 * Mark a lead Lost with a required structured reason.
 * Accepts a venue pipeline stage id (Lost / Cancelled reporting category) or the sales_stage key "lost".
 */
export async function markLeadLost(
  leadId: string,
  input: { reason: string; detail?: string | null },
  stageKeyOrId?: string,
): Promise<LeadActionResult> {
  const { validateLostReasonInput, isLostReasonValue } = await import("@/lib/leads/lost-reasons");
  if (!isLostReasonValue(input.reason)) {
    return { ok: false, message: "Choose a lost reason." };
  }
  const lostErr = validateLostReasonInput({
    reason: input.reason,
    detail: input.detail,
  });
  if (lostErr) return { ok: false, message: lostErr };

  const detail = input.detail?.trim() || null;
  const target = stageKeyOrId?.trim() || "lost";
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);

  if (looksLikeUuid) {
    return withVenue(async (supabase, venueId) => {
      const { data: stage, error } = await supabase
        .from("pipeline_stages")
        .select("id, canonical_stage, pipeline_template_id")
        .eq("id", target)
        .eq("venue_id", venueId)
        .maybeSingle<{ id: string; canonical_stage: string; pipeline_template_id: string }>();
      if (error) throw error;
      if (!stage) return { ok: false, message: "That pipeline stage was not found." } as LeadActionResult;

      const { transitionKindForCanonical } = await import("@/lib/leads/pipeline-stage-transition");
      if (transitionKindForCanonical(stage.canonical_stage) !== "lost") {
        return { ok: false, message: "That stage is not a Lost stage." } as LeadActionResult;
      }
      const { data: tpl } = await supabase
        .from("pipeline_templates")
        .select("is_active")
        .eq("id", stage.pipeline_template_id)
        .eq("venue_id", venueId)
        .maybeSingle<{ is_active: boolean }>();
      if (!tpl?.is_active) {
        return { ok: false, message: "That stage is not on the active pipeline." } as LeadActionResult;
      }

      return updateLeadSalesStage(leadId, "lost", {
        pipelineStageId: stage.id,
        lost: { reason: input.reason, detail },
      });
    }) as Promise<LeadActionResult>;
  }

  return updateLeadSalesStage(leadId, "lost", {
    pipelineStageId: null,
    lost: { reason: input.reason, detail },
  });
}

/**
 * Confirmed Mark as Booked: reuse or create the client and event, then
 * run the same bookClient transition automatic booking uses.
 */
async function linkBookedCommercialSelection(input: {
  selectionId?: string | null;
  leadId?: string | null;
  clientId: string;
  eventId: string | null;
}): Promise<void> {
  if (!input.eventId) return;
  const {
    getActiveSelectedPackageForLead,
    getActiveSelectedPackageForClient,
    attachSelectionToBookingFile,
  } = await import("@/lib/commercial-selections/service");
  let selectionId = input.selectionId ?? null;
  if (!selectionId && input.leadId) {
    selectionId = (await getActiveSelectedPackageForLead(input.leadId))?.id ?? null;
  }
  if (!selectionId) {
    selectionId = (await getActiveSelectedPackageForClient(input.clientId))?.id ?? null;
  }
  if (!selectionId) return;
  await attachSelectionToBookingFile(selectionId, {
    clientId: input.clientId,
    eventId: input.eventId,
    leadId: input.leadId ?? undefined,
  });
}

export async function confirmPipelineBookedMove(
  leadId: string,
  stageKeyOrId: string,
  opts?: {
    spaceId?: string;
    selectionId?: string;
    occupancy?: import("@/lib/booking-journey/confirmed-occupancy").ConfirmedBookingOccupancy;
  },
): Promise<
  | { ok: true; clientId: string; eventId: string | null; invitationSent: false; warning?: string; newlyBooked: boolean }
  | { ok: false; message: string }
> {
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageKeyOrId);

  const resolved = await withVenue(async (supabase, venueId) => {
    let pipelineStageId: string | null = null;

    if (looksLikeUuid) {
      const { data: stage, error } = await supabase
        .from("pipeline_stages")
        .select("id, canonical_stage, pipeline_template_id")
        .eq("id", stageKeyOrId)
        .eq("venue_id", venueId)
        .maybeSingle<{ id: string; canonical_stage: string; pipeline_template_id: string }>();
      if (error) throw error;
      if (!stage) return { ok: false as const, message: "That pipeline stage was not found." };
      const { transitionKindForCanonical } = await import("@/lib/leads/pipeline-stage-transition");
      if (transitionKindForCanonical(stage.canonical_stage) !== "booked") {
        return { ok: false as const, message: "That stage is not mapped to Booked." };
      }
      const { data: tpl } = await supabase
        .from("pipeline_templates")
        .select("is_active")
        .eq("id", stage.pipeline_template_id)
        .eq("venue_id", venueId)
        .maybeSingle<{ is_active: boolean }>();
      if (!tpl?.is_active) {
        return { ok: false as const, message: "That stage is not on the active pipeline." };
      }
      pipelineStageId = stage.id;
    } else if (stageKeyOrId !== "booked") {
      return { ok: false as const, message: "That is not a Booked stage." };
    }

    const lead = await repo.getLead(supabase, venueId, leadId);
    if (!lead) return { ok: false as const, message: "Lead not found." };

    const occupancy = opts?.occupancy;
    if (!occupancy?.eventDate?.trim()) {
      return { ok: false as const, message: "Confirm the event date, spaces, and times before booking this relationship." };
    }
    const { bookingConfirmationError } = await import("@/lib/booking-journey/confirmed-occupancy");
    const { data: rules } = await supabase
      .from("venue_capacity_rules")
      .select("max_simultaneous_events")
      .eq("venue_id", venueId)
      .maybeSingle<{ max_simultaneous_events: number | null }>();
    const { effectiveMaxSimultaneousEvents } = await import("@/lib/availability/event-occupancy");
    const occupancyError = bookingConfirmationError(
      occupancy,
      effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: rules?.max_simultaneous_events ?? 1 }),
    );
    if (occupancyError) return { ok: false as const, message: occupancyError };

    const spaceId = occupancy.spaceId?.trim() || undefined;

    const { convertLeadToClient } = await import("@/lib/clients/service");
    const converted = await convertLeadToClient(lead, { spaceId });
    if (!converted.ok) return converted;

    let warning: string | undefined;
    const { getActiveSelectedPackageForLead, attachSelectionToBookingFile } = await import(
      "@/lib/commercial-selections/service"
    );
    const attachId = opts?.selectionId
      ?? (await getActiveSelectedPackageForLead(lead.id))?.id
      ?? null;
    if (attachId) {
      const attached = await attachSelectionToBookingFile(attachId, {
        clientId: converted.clientId,
        eventId: converted.eventId,
        leadId: lead.id,
      });
      if (!attached.ok) {
        warning = attached.message
          ? `Booking file started, but the selected package could not be linked: ${attached.message}.`
          : "Booking file started, but the selected package could not be linked.";
      }
    }

    const { bookClient } = await import("@/lib/booking-journey/book-client");
    const booked = await bookClient(supabase, {
      venueId,
      clientId: converted.clientId,
      eventId: converted.eventId,
      leadId: lead.id,
      pipelineStageId,
      source: "manual",
      spaceId,
      confirmedOccupancy: occupancy,
    });
    if (!booked.ok) {
      return { ok: false as const, message: booked.message };
    }

    if (booked.eventId) {
      await linkBookedCommercialSelection({
        selectionId: attachId,
        leadId: lead.id,
        clientId: converted.clientId,
        eventId: booked.eventId,
      });
    }

    if (booked.eventId) {
      const { applyEventAssignmentAfterBooking } = await import("@/lib/team/booking-assignment");
      const assigned = await applyEventAssignmentAfterBooking({
        supabase,
        venueId,
        eventId: booked.eventId,
        selectedStaffId: occupancy.assignedStaffId,
      });
      if (!assigned.ok) {
        warning = warning
          ? `${warning} Team assignment was not saved: ${assigned.message}`
          : `Booked, but the team assignment was not saved: ${assigned.message}`;
      }
    }

    return {
      ok: true as const,
      clientId: converted.clientId,
      eventId: booked.eventId,
      invitationSent: false as const,
      warning,
      newlyBooked: booked.newlyBooked,
    };
  });

  if (!resolved.ok) {
    return {
      ok: false,
      message: "message" in resolved && resolved.message ? resolved.message : "Could not book this client.",
    };
  }
  if (!("newlyBooked" in resolved)) {
    return { ok: false, message: "Could not book this client." };
  }
  return resolved;
}

/**
 * Deliberate Booked → Sales Pipeline return.
 * Destination is the pipeline entry stage (new_inquiry) — never invents prior-stage history.
 * Preserves client/event/documents/financials/first_booked_at (stage-only change).
 */
export async function moveLeadBackToSalesPipeline(leadId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: row } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (!row) return { ok: false, message: "Lead not found." } as LeadActionResult;
    if (row.sales_stage !== "booked") {
      return { ok: false, message: "This lead is not currently Booked." } as LeadActionResult;
    }
    const { data: linked } = await supabase.from("clients").select("id")
      .eq("lead_id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();
    if (linked) {
      const { data: bookedEvent } = await supabase.from("events").select("id")
        .eq("client_id", linked.id).eq("venue_id", venueId)
        .not("booked_at", "is", null)
        .neq("status", "cancelled")
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (bookedEvent) {
        return {
          ok: false,
          message: "This client is booked. Cancel the event to leave Booked.",
        } as LeadActionResult;
      }
    }
    return updateLeadSalesStage(leadId, SALES_PIPELINE_RETURN_STAGE, { allowLeaveBooked: true });
  });
  return result as LeadActionResult;
}

/**
 * A cancelled booked relationship is not an active Booked Client.
 * sales_stage leaves `booked`. Historical events.booked_at is not cleared.
 * `cancelled` is not a sales-pipeline column and is not Lost.
 */
export async function leaveActiveBookedPipeline(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  clientId: string,
): Promise<void> {
  const { data: client } = await supabase
    .from("clients")
    .select("lead_id")
    .eq("id", clientId)
    .eq("venue_id", venueId)
    .maybeSingle<{ lead_id: string | null }>();
  const leadId = client?.lead_id;
  if (!leadId) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("sales_stage")
    .eq("id", leadId)
    .eq("venue_id", venueId)
    .maybeSingle<{ sales_stage: string | null }>();
  if (!lead || lead.sales_stage !== "booked") return;

  const { error } = await supabase
    .from("leads")
    .update({
      sales_stage: CANCELLED_RELATIONSHIP_STAGE,
      pipeline_stage_id: null,
      lost_reason: null,
      lost_reason_detail: null,
      lost_at: null,
    })
    .eq("id", leadId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Mark a previously linked relationship as Booked.
 * Requires an existing linked client — does not create a new client/event.
 * An already-active Booked lead is a no-op. A cancelled relationship
 * (even if sales_stage was left on booked) calls bookClient.
 * Same canonical bookClient transition as pipeline Mark as Booked.
 */
export async function returnLeadToBooked(
  leadId: string,
  occupancy?: import("@/lib/booking-journey/confirmed-occupancy").ConfirmedBookingOccupancy,
): Promise<
  | { ok: true; clientId: string; eventId: string | null; newlyBooked: boolean }
  | { ok: false; message: string }
> {
  const result = await withVenue(async (supabase, venueId) => {
    const { data: row } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ sales_stage: string | null }>();
    if (!row) return { ok: false as const, message: "Lead not found." };

    const { data: linked } = await supabase.from("clients").select("id")
      .eq("lead_id", leadId).eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();
    if (!linked) {
      return {
        ok: false as const,
        message: "There is no client linked to this inquiry yet. Create a contract or set up payments from Commercial first, or start the booking file.",
      };
    }

    if (row.sales_stage === "booked") {
      const { data: cancelledEvent } = await supabase.from("events").select("id")
        .eq("client_id", linked.id).eq("venue_id", venueId)
        .eq("status", "cancelled")
        .not("booked_at", "is", null)
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (!cancelledEvent) {
        return {
          ok: true as const,
          clientId: linked.id,
          eventId: null,
          newlyBooked: false,
        };
      }
    }

    if (!occupancy?.eventDate?.trim()) {
      return { ok: false as const, message: "Confirm the event date, spaces, and times before booking this relationship." };
    }
    const { bookingConfirmationError } = await import("@/lib/booking-journey/confirmed-occupancy");
    const { data: rules } = await supabase
      .from("venue_capacity_rules")
      .select("max_simultaneous_events")
      .eq("venue_id", venueId)
      .maybeSingle<{ max_simultaneous_events: number | null }>();
    const { effectiveMaxSimultaneousEvents } = await import("@/lib/availability/event-occupancy");
    const occupancyError = bookingConfirmationError(
      occupancy,
      effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: rules?.max_simultaneous_events ?? 1 }),
    );
    if (occupancyError) return { ok: false as const, message: occupancyError };

    const { bookClient } = await import("@/lib/booking-journey/book-client");
    const booked = await bookClient(supabase, {
      venueId,
      clientId: linked.id,
      leadId,
      source: "manual",
      spaceId: occupancy.spaceId,
      confirmedOccupancy: occupancy,
    });
    if (!booked.ok) return { ok: false as const, message: booked.message };
    if (booked.eventId) {
      await linkBookedCommercialSelection({
        leadId,
        clientId: linked.id,
        eventId: booked.eventId,
      });
      const { applyEventAssignmentAfterBooking } = await import("@/lib/team/booking-assignment");
      await applyEventAssignmentAfterBooking({
        supabase,
        venueId,
        eventId: booked.eventId,
        selectedStaffId: occupancy.assignedStaffId,
      });
    }
    return {
      ok: true as const,
      clientId: linked.id,
      eventId: booked.eventId ?? null,
      newlyBooked: booked.newlyBooked,
    };
  });
  return result as
    | { ok: true; clientId: string; eventId: string | null; newlyBooked: boolean }
    | { ok: false; message: string };
}

/**
 * Same canonical bookClient transition as Return to Booked, starting from
 * the client rather than the lead. Does not create records.
 */
export async function returnClientToBooked(
  clientId: string,
  occupancy?: import("@/lib/booking-journey/confirmed-occupancy").ConfirmedBookingOccupancy,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    if (!occupancy?.eventDate?.trim()) {
      return { ok: false, message: "Confirm the event date, spaces, and times before booking this relationship." } as LeadActionResult;
    }
    const { bookingConfirmationError } = await import("@/lib/booking-journey/confirmed-occupancy");
    const { data: rules } = await supabase
      .from("venue_capacity_rules")
      .select("max_simultaneous_events")
      .eq("venue_id", venueId)
      .maybeSingle<{ max_simultaneous_events: number | null }>();
    const { effectiveMaxSimultaneousEvents } = await import("@/lib/availability/event-occupancy");
    const occupancyError = bookingConfirmationError(
      occupancy,
      effectiveMaxSimultaneousEvents({ maxSimultaneousEvents: rules?.max_simultaneous_events ?? 1 }),
    );
    if (occupancyError) return { ok: false, message: occupancyError } as LeadActionResult;
    const { bookClient } = await import("@/lib/booking-journey/book-client");
    const booked = await bookClient(supabase, {
      venueId,
      clientId,
      source: "manual",
      spaceId: occupancy.spaceId,
      confirmedOccupancy: occupancy,
    });
    if (!booked.ok) return { ok: false, message: booked.message } as LeadActionResult;
    if (booked.eventId) {
      await linkBookedCommercialSelection({
        clientId,
        eventId: booked.eventId,
      });
      const { applyEventAssignmentAfterBooking } = await import("@/lib/team/booking-assignment");
      await applyEventAssignmentAfterBooking({
        supabase,
        venueId,
        eventId: booked.eventId,
        selectedStaffId: occupancy.assignedStaffId,
      });
    }
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function wouldEnrollOnPipelineStageMove(
  leadId: string,
  stageKeyOrId: string,
): Promise<
  | { ok: true; wouldEnroll: boolean; preview: AutomationMessagePreview | null; plan: StageChangeMessagePlan | null }
  | { ok: false; message: string }
> {
  let salesStageKey = stageKeyOrId;
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stageKeyOrId);
  if (looksLikeUuid) {
    const venue = await getCurrentVenue();
    if (!venue) return { ok: false, message: "No venue found." };
    const supabase = await createClient();
    const { data: stage } = await supabase
      .from("pipeline_stages")
      .select("canonical_stage")
      .eq("id", stageKeyOrId)
      .eq("venue_id", venue.id)
      .maybeSingle<{ canonical_stage: string }>();
    if (!stage) return { ok: false, message: "That pipeline stage was not found." };
    const { salesStageForCanonical } = await import("@/lib/pipeline-templates/sales-stage-bridge");
    const { isCanonicalStage } = await import("@/lib/pipeline-templates/types");
    if (!isCanonicalStage(stage.canonical_stage)) return { ok: false, message: "Invalid reporting category." };
    const { data: currentLead } = await supabase.from("leads").select("sales_stage")
      .eq("id", leadId).eq("venue_id", venue.id)
      .maybeSingle<{ sales_stage: string | null }>();
    const fallback = currentLead?.sales_stage && isSalesStage(currentLead.sales_stage)
      ? currentLead.sales_stage
      : "new_inquiry";
    salesStageKey = salesStageForCanonical(stage.canonical_stage, fallback);
  }
  if (!isSalesStage(salesStageKey)) return { ok: false, message: "Invalid sales stage." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("relationship_id")
    .eq("id", leadId).eq("venue_id", venue.id)
    .maybeSingle<{ relationship_id: string | null }>();
  if (!lead?.relationship_id) return { ok: true, wouldEnroll: false, preview: null, plan: null };
  const check = await wouldEnrollOnStageChange(supabase, venue.id, lead.relationship_id, salesStageKey);
  const steps = [];
  for (const sequence of check.sequences) {
    steps.push(...await previewStepsForSequence(supabase, venue.id, sequence.id, lead.relationship_id));
  }
  const plan: StageChangeMessagePlan | null = check.wouldEnroll
    ? { steps, advancesPipeline: check.sequences.some((sequence) => sequence.updatePipelineOnEnroll) }
    : null;
  const firstPreview = steps.find((step) => step.preview.ok)?.preview ?? steps[0]?.preview ?? null;
  return { ok: true, wouldEnroll: check.wouldEnroll, preview: firstPreview, plan };
}

/**
 * Ensure the Standard pipeline exists, is active, and matches the product baseline.
 * Idempotent — safe on every Leads / Board load and on venue provisioning.
 */
export async function ensureStandardSalesPipelineForCurrentVenue(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase.rpc("ensure_standard_sales_pipeline", { p_venue_id: venue.id });
}

// ---- notes ------------------------------------------------------------------

export async function addNote(
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertNote(supabase, venueId, leadId, body);
    await repo.insertActivity(supabase, venueId, leadId, "note_added", "Note added");
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateNote(
  noteId: string,
  leadId: string,
  body: string,
): Promise<LeadActionResult> {
  if (!body.trim()) return { ok: false, message: "Note cannot be empty." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateNote(supabase, venueId, noteId, body);
    await repo.insertActivity(supabase, venueId, leadId, "note_updated", "Note edited");
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function deleteNote(noteId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const deleted = await repo.deleteNote(supabase, venueId, noteId);
    if (!deleted.ok) return { ok: false, message: deleted.message } as LeadActionResult;
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- tasks ------------------------------------------------------------------

export async function addTask(
  leadId: string,
  input: TaskInput,
): Promise<LeadActionResult> {
  const errors = validateTaskInput(input);
  if (Object.keys(errors).length > 0)
    return { ok: false, errors, message: errors.title };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.insertTask(supabase, venueId, leadId, input);
    await repo.insertActivity(supabase, venueId, leadId, "task_created", `Task added: ${input.title.trim()}`);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateTask(
  taskId: string,
  input: { title: string; dueDate: string; assignedToStaffId?: string | null },
): Promise<LeadActionResult> {
  if (!input.title.trim()) return { ok: false, message: "Task title is required." };
  const result = await withVenue(async (supabase, venueId) => {
    await repo.updateTask(supabase, venueId, taskId, input);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function setTaskCompleted(
  taskId: string,
  completed: boolean,
  leadId?: string,
  taskTitle?: string,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    await repo.setTaskCompleted(supabase, venueId, taskId, completed);
    if (completed && leadId && taskTitle) {
      await repo.insertActivity(supabase, venueId, leadId, "task_completed", `Task completed: ${taskTitle}`);
    }
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function deleteTask(taskId: string): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const deleted = await repo.deleteTask(supabase, venueId, taskId);
    if (!deleted.ok) return { ok: false, message: deleted.message } as LeadActionResult;
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

// ---- Sprint 6: lead info + relationship -------------------------------------

/**
 * Autosave the Lead's planned Event Space. Planning only: no Event row,
 * no sales-stage change, no booked_at stamp.
 */
export async function setLeadPlannedEventSpace(
  leadId: string,
  spaceId: string | null,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const trimmed = spaceId?.trim() || null;
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();
    if (!lead) return { ok: false, message: "Lead not found." } as LeadActionResult;

    if (trimmed) {
      const { data: space } = await supabase
        .from("venue_spaces")
        .select("id")
        .eq("id", trimmed)
        .eq("venue_id", venueId)
        .maybeSingle<{ id: string }>();
      if (!space) {
        return { ok: false, message: "That event space is not on this venue." } as LeadActionResult;
      }
    }

    await repo.setPlannedEventSpace(supabase, venueId, leadId, trimmed);
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateLeadInfo(
  leadId: string,
  input: LeadInput,
): Promise<LeadActionResult> {
  const errors = validateLeadInput(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const result = await withVenue(async (supabase, venueId) => {
    const [{ data: existing, error: existingError }, { data: venueRow }] = await Promise.all([
      supabase
        .from("leads")
        .select("event_type, inquiry_message, inquiry_message_origin")
        .eq("id", leadId)
        .eq("venue_id", venueId)
        .maybeSingle<{
          event_type: string | null;
          inquiry_message: string | null;
          inquiry_message_origin: string | null;
        }>(),
      supabase
        .from("venues")
        .select("accepted_inquiry_event_types")
        .eq("id", venueId)
        .maybeSingle<{ accepted_inquiry_event_types: unknown }>(),
    ]);
    if (existingError) throw existingError;
    if (!existing) return { ok: false, message: "Lead not found." } as LeadActionResult;

    const { assertEventTypeChangeAllowed } = await import(
      "@/lib/event-types/assert-accepted"
    );
    const change = assertEventTypeChangeAllowed({
      previousEventType: existing?.event_type,
      nextEventType: input.eventType,
      acceptedRaw: venueRow?.accepted_inquiry_event_types,
    });
    if (!change.ok) {
      return {
        ok: false,
        errors: { eventType: change.error },
        message: change.error,
      } as LeadActionResult;
    }

    await repo.updateLeadInfo(supabase, venueId, leadId, {
      ...input,
      inquiryMessageOrigin: originAfterStaffEdit({
        previousMessage: existing?.inquiry_message,
        nextMessage: input.inquiryMessage,
        previousOrigin: existing?.inquiry_message_origin,
      }),
    });
    await repo.insertActivity(supabase, venueId, leadId, "lead_updated", "Lead information updated");
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function updateRelationshipFields(
  leadId: string,
  input: RelationshipInput,
  activityHints: { tourScheduled?: boolean; followUpSet?: boolean; contactedSet?: boolean },
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    let tourConflict: { message: string } | undefined;
    try {
      const outcome = await repo.updateRelationshipFields(supabase, venueId, leadId, input);
      tourConflict = outcome.tourConflict;
    } catch (err) {
      if (err instanceof LeadTourWriteError) {
        return { ok: false, message: err.message || TOUR_TIME_REQUIRED } as LeadActionResult;
      }
      throw err;
    }
    // Log specific meaningful events rather than a generic "updated".
    // Tour capacity conflict still saved follow-up — do not invent a tour_scheduled activity.
    if (!tourConflict && activityHints.tourScheduled && input.tourDate && input.tourTime) {
      const { formatDate } = await import("@/lib/leads/constants");
      await repo.insertActivity(supabase, venueId, leadId, "tour_scheduled",
        `Tour scheduled for ${formatDate(input.tourDate)}`);
    } else if (activityHints.followUpSet && input.followUpDate) {
      const { formatDate } = await import("@/lib/leads/constants");
      await repo.insertActivity(supabase, venueId, leadId, "follow_up_set",
        `Follow-up set for ${formatDate(input.followUpDate)}`);
    } else if (activityHints.contactedSet && input.lastContactedAt) {
      await repo.insertActivity(supabase, venueId, leadId, "last_contacted",
        "Marked as last contacted");
    } else {
      await repo.insertActivity(supabase, venueId, leadId, "relationship_updated",
        "Relationship details updated");
    }
    return { ok: true, tourConflict } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function completeFollowUp(
  leadId: string,
  input: FollowUpCompletionInput,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const current = await repo.getOutstandingFollowUp(supabase, venueId, leadId);
    if (!current) return { ok: false, message: "Lead not found." } as LeadActionResult;
    const resolved = resolveFollowUpCompletion(current, input);
    if (!resolved.ok) return { ok: false, message: resolved.message } as LeadActionResult;

    await repo.updateOutstandingFollowUp(supabase, venueId, leadId, {
      nextActionText: resolved.nextActionText,
      followUpDate: resolved.followUpDate,
    });

    const { formatDate } = await import("@/lib/leads/constants");
    await repo.insertActivity(
      supabase,
      venueId,
      leadId,
      "follow_up_completed",
      followUpCompletedTitle(resolved.completedDate, formatDate),
      resolved.completedAction ?? undefined,
    );
    if (resolved.writeFollowUpSet && resolved.followUpDate) {
      await repo.insertActivity(
        supabase,
        venueId,
        leadId,
        "follow_up_set",
        `Follow-up set for ${formatDate(resolved.followUpDate)}`,
      );
    }
    return { ok: true } as LeadActionResult;
  });
  return result as LeadActionResult;
}

export async function setLeadAssignedStaff(
  leadId: string,
  staffId: string | null,
): Promise<LeadActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { persistLeadStaffAssignment } = await import("@/lib/team/staff-assignment");
    return persistLeadStaffAssignment(supabase, venueId, leadId, staffId);
  });
  return result as LeadActionResult;
}
