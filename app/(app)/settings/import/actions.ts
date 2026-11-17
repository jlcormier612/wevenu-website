"use server";

import { revalidatePath } from "next/cache";

import { commitImportedClientAndEvent, classifyClientImportRow } from "@/lib/clients/import-booked-client";
import { matchIncomingClient, matchIncomingClientForVenue } from "@/lib/clients/service";
import {
  personMatchSkipMessage,
  resolvePersonMatchAction,
  type PersonMatchAction,
} from "@/lib/import/match-policy";
import {
  classifyVenueControlledMatch,
  importedLeadIdentityDecision,
  incomingPersonFromLeadInput,
  importMatchRecordFromIncoming,
  rememberCreatedImportLead,
  resolveImportMatchAction,
  venueMatchSkipMessage,
  type ImportMatchRecord,
} from "@/lib/import/venue-controlled-match";
import { resolveSpaceId } from "@/lib/migration/resolve-refs";
import { DISPLAY_SHAPES } from "@/components/floor-plan/floor-plan-shapes";
import { acceptCreatedImportRow, createImportBatch, finalizeImportBatch, getImportBatches, rollbackImportBatch, type RollbackResult } from "@/lib/import/batches";
import { decideHistoricalImportDuplicate, haltUntrackedHistoricalImport } from "@/lib/import/historical-guard";
import { extractDocxText, extractPdfText, parseExcelFile } from "@/lib/import/file-parsing";
import {
  catalogNameWithinFileKey,
  normalizeImportAmount,
  normalizeImportDate,
  normalizeImportQuantity,
  normalizeImportVendorPricingTier,
  personEmailWithinFileKey,
  vendorWithinFileKey,
} from "@/lib/import/preview-integrity";
import type { InventoryImportRow, PackageImportRow } from "@/lib/import/utils";
import { createCategory, createItem as createInventoryItem, findActiveDuplicateInventoryItem, getCategories } from "@/lib/inventory/service";
import { LEAD_BOOKED_STATUS_HOLD, parseImportedLeadSalesStage } from "@/lib/import/lead-import";
import { createLead, listImportMatchRecords, listImportMatchRecordsForVenue } from "@/lib/leads/service";
import { proposeFieldMapping, proposeStructuredRows } from "@/lib/luv/import-assist";
import { addPackageItems, createPackage, findActiveDuplicatePackage } from "@/lib/packages/service";
import { createVendor, findActiveDuplicateVendor } from "@/lib/vendors/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { createClient } from "@/integrations/supabase/server";
import type { ClientInput } from "@/lib/clients/types";
import type { InventoryItemInput, InventoryShape } from "@/lib/inventory/types";
import type { LeadInput } from "@/lib/leads/types";
import type { PackageInput } from "@/lib/packages/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { EntityType, ImportBatch, ImportResult } from "@/lib/import/types";

async function venueRequiresNamedSpace(): Promise<boolean> {
  const venue = await getCurrentVenue();
  if (!venue) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("venue_capacity_rules")
    .select("max_simultaneous_events")
    .eq("venue_id", venue.id)
    .maybeSingle<{ max_simultaneous_events: number }>();
  return (data?.max_simultaneous_events ?? 1) >= 2;
}

async function withResolvedSpace(input: ClientInput): Promise<{ ok: true; input: ClientInput } | { ok: false; message: string }> {
  const raw = input.spaceId.trim();
  if (!raw) return { ok: true, input };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
  const resolved = await resolveSpaceId(supabase, venue.id, uuidLike ? raw : null, uuidLike ? null : raw);
  if (!resolved.ok) return { ok: false, message: resolved.error };
  return { ok: true, input: { ...input, spaceId: resolved.spaceId ?? "" } };
}

export async function getImportBatchesAction(entityType?: EntityType): Promise<ImportBatch[]> {
  return getImportBatches(entityType);
}

export async function rollbackImportBatchAction(batchId: string): Promise<RollbackResult> {
  const result = await rollbackImportBatch(batchId);
  if (result.ok) revalidatePath("/settings/import");
  return result;
}

export type ParsedImportTable =
  | { ok: true; headers: string[]; rows: Record<string, string>[]; assisted: boolean }
  | { ok: false; message: string };

// Excel parses to real columns deterministically — no Luv involved, same
// trust level as CSV. Word/PDF only ever yield raw text, so those hand off
// to Luv's proposal, clearly marked (`assisted: true`) so the wizard can
// flag guessed rows for extra scrutiny before import.
export async function parseImportFileAction(formData: FormData, entity: EntityType): Promise<ParsedImportTable> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "No file received." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const { headers, rows } = await parseExcelFile(buffer);
      if (headers.length === 0) return { ok: false, message: "Couldn't find any columns in this spreadsheet." };
      return { ok: true, headers, rows, assisted: false };
    }
    if (name.endsWith(".docx")) {
      const text = await extractDocxText(buffer);
      return await runLuvProposal(text, entity);
    }
    if (name.endsWith(".pdf")) {
      const text = await extractPdfText(buffer);
      if (!text.trim()) return { ok: false, message: "We couldn't read text from this PDF — it may be a scanned image. Try Copy/Paste instead." };
      return await runLuvProposal(text, entity);
    }
    return { ok: false, message: "That file type isn't supported yet. Try .csv, .xlsx, .docx, .pdf, or Copy/Paste." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't read this file." };
  }
}

// Copy/Paste of freeform (non-tabular) text — the client already tries
// Papa.parse first and only falls back to this when the pasted text doesn't
// look like clean columns.
export async function parseImportTextAction(text: string, entity: EntityType): Promise<ParsedImportTable> {
  return runLuvProposal(text, entity);
}

async function runLuvProposal(text: string, entity: EntityType): Promise<ParsedImportTable> {
  const result = await proposeStructuredRows(text, entity);
  if (!result.ok) return result;
  return { ok: true, headers: result.headers, rows: result.rows, assisted: result.aiStructured };
}

/**
 * Migration Center §2.1 item 4 (2026-07-22) — shared by both the
 * self-service wizard and the White-Glove "Importing for {venue}" mode
 * (both render components/settings/import-wizard.tsx, which already
 * imports parseImportFileAction/parseImportTextAction from this same
 * file) — no venue context is needed here at all, just headers + entity,
 * so one action serves both entry points without an admin-specific copy.
 */
export async function proposeFieldMappingAction(headers: string[], entity: EntityType) {
  return proposeFieldMapping(headers, entity);
}

export type PersonMatchPreviewRow = {
  row: number;
  name: string;
  email: string;
  kind: "exact" | "likely" | "new";
  reason: string;
  defaultAction: PersonMatchAction;
  matchedId: string | null;
  matchedName: string | null;
  matchedEmail: string | null;
  matchedPhone?: string | null;
  matchedEventDate?: string | null;
  matchedSalesStage?: string | null;
  needsReview?: boolean;
  alreadyImported?: boolean;
  changedSinceImport?: boolean;
  fileMatchRow?: number | null;
  signals?: string[];
  inquiryNotes?: string[];
  differences?: Array<{ label: string; incoming: string; existing: string }>;
  inquiryDisposition?: "retry" | "additional" | "new" | "uncertain";
};

export async function previewPersonMatchesAction(
  entity: "couples" | "leads",
  rows: Array<{
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    partnerFirstName?: string | null;
    partnerLastName?: string | null;
    partnerEmail?: string | null;
    eventDate?: string | null;
    eventType?: string | null;
    guestCount?: string | null;
    source?: string | null;
    originalSourceLabel?: string | null;
    inquiryMessage?: string | null;
    followUpDate?: string | null;
    nextActionText?: string | null;
    dateFlexibility?: string | null;
    salesStage?: string | null;
    estimatedBudget?: string | null;
    sourceRecordId?: string | null;
  }>,
  venueId?: string,
): Promise<PersonMatchPreviewRow[]> {
  const out: PersonMatchPreviewRow[] = [];
  const existingLeads = entity === "leads"
    ? (venueId ? await listImportMatchRecordsForVenue(venueId) : await listImportMatchRecords())
    : [];
  const priorInFile: ImportMatchRecord[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (entity === "couples") {
      const decision = venueId
        ? await matchIncomingClientForVenue(venueId, row)
        : await matchIncomingClient(row);
      out.push({
        row: i + 1,
        name: `${row.firstName} ${row.lastName}`.trim(),
        email: (row.email ?? "").trim(),
        kind: decision.kind,
        reason: decision.reason,
        defaultAction: decision.defaultAction,
        matchedId: decision.matchedId,
        matchedName: decision.matchedName,
        matchedEmail: decision.matchedEmail,
        needsReview: decision.kind === "likely",
        alreadyImported: false,
      });
      continue;
    }

    const incoming = incomingPersonFromLeadInput(row);
    const match = classifyVenueControlledMatch(incoming, existingLeads, priorInFile);
    out.push({
      row: i + 1,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email: (row.email ?? "").trim(),
      kind: match.kind,
      reason: match.reason,
      defaultAction: match.defaultAction,
      matchedId: match.matchedId,
      matchedName: match.matchedName,
      matchedEmail: match.matchedEmail,
      matchedPhone: match.matchedPhone,
      matchedEventDate: match.matchedEventDate,
      matchedSalesStage: match.matchedSalesStage,
      needsReview: match.needsReview,
      alreadyImported: match.alreadyImported,
      changedSinceImport: match.changedSinceImport,
      fileMatchRow: match.fileMatchRow,
      signals: match.signals,
      inquiryNotes: match.inquiryNotes,
      differences: match.differences,
    });
    priorInFile.push(importMatchRecordFromIncoming(incoming, i + 1));
  }
  return out;
}

export async function importCouplesAction(
  rows: ClientInput[],
  sourceLabel?: string,
  matchActions?: Array<PersonMatchAction | null>,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const tracked = haltUntrackedHistoricalImport(
    venue?.id,
    venue ? await createImportBatch(venue.id, "couples", sourceLabel ?? null, rows.length) : null,
  );
  if (!tracked.ok) return tracked.result;
  if (!venue) return { imported: 0, errors: [{ row: 0, message: "No venue found.", kind: "error" }], batchId: null };
  const batchId = tracked.batchId;
  const seenEvents = new Set<string>();
  const requiresSpace = await venueRequiresNamedSpace();
  const supabase = await createClient();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }
    const eventDateNorm = normalizeImportDate(row.eventDate ?? "");
    const endDateNorm = normalizeImportDate(row.endDate ?? "");
    if (!eventDateNorm.ok) {
      errors.push({ row: i + 1, message: eventDateNorm.message, kind: "error" });
      continue;
    }
    if (!endDateNorm.ok) {
      errors.push({ row: i + 1, message: endDateNorm.message, kind: "error" });
      continue;
    }
    const normalizedRow: ClientInput = {
      ...row,
      eventDate: eventDateNorm.value ?? "",
      endDate: endDateNorm.value ?? "",
    };
    if (row.guestCount?.trim() && !/^\d+$/.test(row.guestCount.trim())) {
      errors.push({ row: i + 1, message: `Guest count must be a whole number (got "${row.guestCount.trim()}").`, kind: "error" });
      continue;
    }
    const personKey = `${(normalizedRow.firstName ?? "").trim().toLowerCase()}|${(normalizedRow.lastName ?? "").trim().toLowerCase()}|${personEmailWithinFileKey(normalizedRow.email ?? "")}`;
    const eventKey = `${personKey}|${normalizedRow.eventDate}`;
    if (seenEvents.has(eventKey)) {
      errors.push({ row: i + 1, message: "Skipped — this event is already in this same file (same person and date)", kind: "skipped" });
      continue;
    }
    seenEvents.add(eventKey);
    const decision = await matchIncomingClient({
      firstName: normalizedRow.firstName,
      lastName: normalizedRow.lastName,
      email: normalizedRow.email,
      partnerFirstName: normalizedRow.partnerFirstName,
      partnerLastName: normalizedRow.partnerLastName,
    });
    const action = resolvePersonMatchAction(decision, matchActions?.[i] ?? null);
    if (action === "skip") {
      errors.push({
        row: i + 1,
        message: personMatchSkipMessage(decision, action),
        kind: "skipped",
      });
      continue;
    }
    try {
      const spaced = await withResolvedSpace(normalizedRow);
      const spaceError = spaced.ok ? null : spaced.message;
      const classified = classifyClientImportRow({
        eventDate: normalizedRow.eventDate,
        bookingStatus: normalizedRow.bookingStatus,
        spaceId: spaced.ok ? spaced.input.spaceId : "",
        requiresSpace,
        spaceResolutionError: spaceError,
      });
      if (classified.kind === "hold") {
        errors.push({ row: i + 1, message: classified.message, kind: "error" });
        continue;
      }
      const result = await commitImportedClientAndEvent({
        supabase,
        venueId: venue.id,
        input: spaced.ok ? spaced.input : normalizedRow,
        classification: classified,
        existingClientId: action === "use_existing" ? decision.matchedId : null,
        isAdmin: false,
      });
      if (!result.ok) {
        errors.push({ row: i + 1, message: result.message, kind: "error" });
        continue;
      }
      if (result.duplicate) {
        errors.push({
          row: i + 1,
          message: "This event is already in Hello to Cheers. No second Event was created.",
          kind: "skipped",
        });
        continue;
      }
      if (action === "use_existing") {
        createdIds.push(result.eventId);
        continue;
      }
      const accepted = await acceptCreatedImportRow({
        entityType: "couples",
        batchId,
        createdId: result.clientId,
        venueId: venue.id,
        rowNumber: i + 1,
      });
      if (accepted.accepted) createdIds.push(result.clientId);
      else errors.push(accepted.error);
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  revalidatePath("/setup-hub/bring-your-business");
  if (createdIds.length > 0) {
    revalidatePath("/clients");
    revalidatePath("/calendar");
  }
  return { imported: createdIds.length, errors, batchId };
}

export async function importLeadsAction(
  rows: LeadInput[],
  sourceLabel?: string,
  matchActions?: Array<PersonMatchAction | null>,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const tracked = haltUntrackedHistoricalImport(
    venue?.id,
    venue ? await createImportBatch(venue.id, "leads", sourceLabel ?? null, rows.length) : null,
  );
  if (!tracked.ok) return tracked.result;
  if (!venue) return { imported: 0, errors: [{ row: 0, message: "No venue found.", kind: "error" }], batchId: null };
  const batchId = tracked.batchId;
  const existing = await listImportMatchRecords();
  const priorInFile: ImportMatchRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }

    const eventDateNorm = normalizeImportDate(row.eventDate ?? "");
    if (!eventDateNorm.ok) {
      errors.push({ row: i + 1, message: eventDateNorm.message, kind: "error" });
      continue;
    }
    const followUpNorm = normalizeImportDate(row.followUpDate ?? "");
    if (!followUpNorm.ok) {
      errors.push({ row: i + 1, message: followUpNorm.message, kind: "error" });
      continue;
    }

    const budgetNorm = normalizeImportAmount(row.estimatedBudget ?? "");
    if (!budgetNorm.ok) {
      errors.push({ row: i + 1, message: budgetNorm.message, kind: "error" });
      continue;
    }
    if (row.guestCount?.trim() && !/^\d+$/.test(row.guestCount.trim())) {
      errors.push({ row: i + 1, message: `Guest count must be a whole number (got "${row.guestCount.trim()}").`, kind: "error" });
      continue;
    }
    const normalizedLead: LeadInput = {
      ...row,
      eventDate: eventDateNorm.value ?? "",
      followUpDate: followUpNorm.value ?? "",
      estimatedBudget: budgetNorm.value,
    };

    const bookedStatus = parseImportedLeadSalesStage(normalizedLead.salesStage);
    if (bookedStatus.kind === "booked") {
      errors.push({ row: i + 1, message: LEAD_BOOKED_STATUS_HOLD, kind: "error" });
      continue;
    }

    const incoming = incomingPersonFromLeadInput(normalizedLead);
    const match = classifyVenueControlledMatch(incoming, existing, priorInFile);
    const action = resolveImportMatchAction(match, matchActions?.[i] ?? null);
    priorInFile.push(importMatchRecordFromIncoming(incoming, i + 1));
    if (action === "held" || action === "skip" || action === "use_existing") {
      errors.push({
        row: i + 1,
        message: venueMatchSkipMessage(match, action),
        kind: "skipped",
      });
      continue;
    }
    // Create another Lead. Same-person confirmation reuses the relationship
    // already created earlier in this file or already in Hello to Cheers.
    // Never books. Never merge existing Lead records.
    try {
      // Historical / CSV Import must not enroll lead_created sequences or
      // fire venue new-inquiry notifications — same contract as Migration
      // Center (createLead(..., "import", true)) and HQ createLeadForVenue.
      const result = await createLead(
        { ...normalizedLead, identityDecision: importedLeadIdentityDecision(match, action) },
        "import",
        true,
      );
      if (result.ok) {
        rememberCreatedImportLead(
          existing,
          incoming,
          i + 1,
          result.leadId,
          result.relationshipId ?? match.relationshipId,
        );
        const accepted = await acceptCreatedImportRow({
          entityType: "leads",
          batchId,
          createdId: result.leadId,
          venueId: venue.id,
          rowNumber: i + 1,
        });
        if (accepted.accepted) createdIds.push(result.leadId);
        else errors.push(accepted.error);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  revalidatePath("/setup-hub/bring-your-business");
  if (createdIds.length > 0) revalidatePath("/leads");
  return { imported: createdIds.length, errors, batchId };
}

export async function importVendorsAction(rows: VendorInput[], sourceLabel?: string): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const tracked = haltUntrackedHistoricalImport(
    venue?.id,
    venue ? await createImportBatch(venue.id, "vendors", sourceLabel ?? null, rows.length) : null,
  );
  if (!tracked.ok) return tracked.result;
  if (!venue) return { imported: 0, errors: [{ row: 0, message: "No venue found.", kind: "error" }], batchId: null };
  const batchId = tracked.batchId;
  const seenVendorKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.businessName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: business name", kind: "skipped" });
      continue;
    }
    const withinKey = vendorWithinFileKey(row.businessName, row.email ?? "");
    if (withinKey) {
      if (seenVendorKeys.has(withinKey)) {
        errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file", kind: "skipped" });
        continue;
      }
      seenVendorKeys.add(withinKey);
    }
    const tierNorm = normalizeImportVendorPricingTier(row.pricingTier ?? "");
    if (!tierNorm.ok) {
      errors.push({ row: i + 1, message: tierNorm.message, kind: "error" });
      continue;
    }
    const normalizedVendor = { ...row, pricingTier: tierNorm.value };
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateVendor(normalizedVendor.businessName, normalizedVendor.email ?? ""),
      "Skipped — matches a vendor already in your directory",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const result = await createVendor(normalizedVendor);
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "vendors",
          batchId,
          createdId: result.vendorId,
          venueId: venue.id,
          rowNumber: i + 1,
        });
        if (accepted.accepted) createdIds.push(result.vendorId);
        else errors.push(accepted.error);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg || "Unknown error", kind: "error" });
      }
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "Unknown error";
      errors.push({ row: i + 1, message: msg, kind: "error" });
    }
  }

  // Vendors: import_batch_id is stamped on the global vendor profile.
  // Compensation/rollback undo this venue's relationship only.
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  revalidatePath("/setup-hub/bring-your-business");
  if (createdIds.length > 0) revalidatePath("/vendors");
  return { imported: createdIds.length, errors, batchId };
}

function normalizeShape(raw: string): InventoryShape | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (DISPLAY_SHAPES as string[]).includes(v) ? (v as InventoryShape) : null;
}

export async function importInventoryAction(rows: InventoryImportRow[], sourceLabel?: string): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const tracked = haltUntrackedHistoricalImport(
    venue?.id,
    venue ? await createImportBatch(venue.id, "inventory", sourceLabel ?? null, rows.length) : null,
  );
  if (!tracked.ok) return tracked.result;
  if (!venue) return { imported: 0, errors: [{ row: 0, message: "No venue found.", kind: "error" }], batchId: null };
  const batchId = tracked.batchId;
  const seenInventoryKeys = new Set<string>();

  // Resolve-or-create categories by name once, reused across every row that
  // names the same category — never a duplicate category per row imported.
  const existingCategories = await getCategories();
  const categoryIdByName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: item name", kind: "skipped" });
      continue;
    }
    const withinKey = catalogNameWithinFileKey(row.name);
    if (withinKey) {
      if (seenInventoryKeys.has(withinKey)) {
        errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file (same name)", kind: "skipped" });
        continue;
      }
      seenInventoryKeys.add(withinKey);
    }
    const qtyNorm = normalizeImportQuantity(row.quantityAvailable);
    if (!qtyNorm.ok) {
      errors.push({ row: i + 1, message: qtyNorm.message, kind: "error" });
      continue;
    }
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateInventoryItem(row.name),
      "Skipped — matches an item already in your inventory",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      let categoryId: string | null = null;
      const categoryName = row.categoryName.trim();
      if (categoryName) {
        const key = categoryName.toLowerCase();
        categoryId = categoryIdByName.get(key) ?? null;
        if (!categoryId) {
          const created = await createCategory(categoryName);
          if (created.ok) {
            categoryId = created.categoryId;
            categoryIdByName.set(key, categoryId);
          }
        }
      }
      const input: InventoryItemInput = {
        name: row.name.trim(),
        categoryId,
        quantityAvailable: parseInt(qtyNorm.value, 10) || 0,
        width: row.width.trim() ? parseFloat(row.width) : null,
        length: row.length.trim() ? parseFloat(row.length) : null,
        height: row.height.trim() ? parseFloat(row.height) : null,
        shape: row.shape.trim() ? normalizeShape(row.shape) : null,
        color: row.color.trim() || null,
        printableName: row.printableName.trim() || null,
        // Bulk-imported inventory is almost always meant to go straight onto
        // Floor Plans — defaulting this on avoids a manual per-item follow-up
        // edit for every row just imported.
        availableForFloorPlans: true,
      };
      const result = await createInventoryItem(input);
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "inventory",
          batchId,
          createdId: result.itemId,
          venueId: venue.id,
          rowNumber: i + 1,
        });
        if (accepted.accepted) createdIds.push(result.itemId);
        else errors.push(accepted.error);
      } else {
        errors.push({ row: i + 1, message: "message" in result ? (result.message ?? "Unknown error") : "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  revalidatePath("/setup-hub/bring-your-business");
  if (createdIds.length > 0) revalidatePath("/library/inventory");
  return { imported: createdIds.length, errors, batchId };
}

export async function importPackagesAction(rows: PackageImportRow[], sourceLabel?: string): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const tracked = haltUntrackedHistoricalImport(
    venue?.id,
    venue ? await createImportBatch(venue.id, "packages", sourceLabel ?? null, rows.length) : null,
  );
  if (!tracked.ok) return tracked.result;
  if (!venue) return { imported: 0, errors: [{ row: 0, message: "No venue found.", kind: "error" }], batchId: null };
  const batchId = tracked.batchId;
  const seenPackageKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: package name", kind: "skipped" });
      continue;
    }
    const withinKey = catalogNameWithinFileKey(row.name);
    if (withinKey) {
      if (seenPackageKeys.has(withinKey)) {
        errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file (same name)", kind: "skipped" });
        continue;
      }
      seenPackageKeys.add(withinKey);
    }
    const priceNorm = normalizeImportAmount(row.basePrice ?? "");
    if (!priceNorm.ok) {
      errors.push({ row: i + 1, message: priceNorm.message, kind: "error" });
      continue;
    }
    const includedItems = row.includedItems ?? [];
    const normalizedPkg: PackageInput = {
      name: row.name,
      description: row.description,
      basePrice: priceNorm.value,
      category: row.category,
      isActive: row.isActive,
    };
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicatePackage(row.name),
      "Skipped — matches a package you already offer",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const result = await createPackage(normalizedPkg);
      if (result.ok) {
        if (includedItems.length > 0) {
          const itemsResult = await addPackageItems(result.packageId, includedItems);
          if (!itemsResult.ok) {
            errors.push({
              row: i + 1,
              message: itemsResult.message ?? "Package created but included items could not be saved.",
              kind: "error",
            });
          }
        }
        const accepted = await acceptCreatedImportRow({
          entityType: "packages",
          batchId,
          createdId: result.packageId,
          venueId: venue.id,
          rowNumber: i + 1,
        });
        if (accepted.accepted) createdIds.push(result.packageId);
        else errors.push(accepted.error);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  revalidatePath("/setup-hub/bring-your-business");
  if (createdIds.length > 0) revalidatePath("/library/packages");
  return { imported: createdIds.length, errors, batchId };
}
