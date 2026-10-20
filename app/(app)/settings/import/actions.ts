"use server";

import { revalidatePath } from "next/cache";

import { createClient_, findActiveDuplicateClient } from "@/lib/clients/service";
import { isPastEventDate } from "@/lib/migration/historical-record";
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
import { createLead, findActiveDuplicateLead, leadInputToRawIntake } from "@/lib/leads/service";
import { logDuplicateBatchRejection } from "@/lib/lead-intake/pipeline";
import { proposeFieldMapping, proposeStructuredRows } from "@/lib/luv/import-assist";
import { addPackageItems, createPackage, findActiveDuplicatePackage } from "@/lib/packages/service";
import { createVendor, findActiveDuplicateVendor } from "@/lib/vendors/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { createClient } from "@/integrations/supabase/server";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";
import type { ClientInput } from "@/lib/clients/types";
import type { InventoryItemInput, InventoryShape } from "@/lib/inventory/types";
import type { LeadInput } from "@/lib/leads/types";
import type { PackageInput } from "@/lib/packages/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { EntityType, ImportBatch, ImportResult } from "@/lib/import/types";

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

export async function importCouplesAction(rows: ClientInput[], sourceLabel?: string): Promise<ImportResult> {
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
  const spaces = await getSpaces();
  const capacityRules = await getCapacityRules();
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spaces.length,
    hasCapacityRules: capacityRules != null,
    maxSimultaneousEvents: capacityRules?.maxSimultaneousEvents ?? null,
  });
  const seenEmails = new Set<string>();

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
    const emailKey = personEmailWithinFileKey(normalizedRow.email ?? "");
    if (emailKey) {
      if (seenEmails.has(emailKey)) {
        errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file (same email)", kind: "skipped" });
        continue;
      }
      seenEmails.add(emailKey);
    }
    if (!cutover.readyForDatedEvents && normalizedRow.eventDate?.trim()) {
      errors.push({ row: i + 1, message: cutover.message ?? "Add Event Spaces before importing dated Events.", kind: "error" });
      continue;
    }
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateClient(normalizedRow.email ?? "", normalizedRow.firstName, normalizedRow.lastName),
      "Skipped — matches an already-active client",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const spaced = await withResolvedSpace(normalizedRow);
      if (!spaced.ok) {
        errors.push({ row: i + 1, message: spaced.message, kind: "error" });
        continue;
      }
      // Past event dates create a historical Event (does not invent commercial
      // booked state for future dates — those stay on the client until booked).
      const asHistorical = isPastEventDate(spaced.input.eventDate);
      const result = await createClient_(
        { ...spaced.input, skipIdentityReview: true },
        true,
        asHistorical,
      );
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "couples",
          batchId,
          createdId: result.clientId,
          venueId: venue.id,
          rowNumber: i + 1,
        });
        if (accepted.accepted) createdIds.push(result.clientId);
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
  if (createdIds.length > 0) revalidatePath("/clients");
  return { imported: createdIds.length, errors, batchId };
}

export async function importLeadsAction(rows: LeadInput[], sourceLabel?: string): Promise<ImportResult> {
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
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }

    // Within-file: email is the only auto-skip key. Blank emails never match
    // each other — same-name rows without email are imported as separate people.
    const emailKey = personEmailWithinFileKey(row.email ?? "");
    if (emailKey) {
      if (seenKeys.has(emailKey)) {
        errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file (same email)", kind: "skipped" });
        if (venue) {
          const supabase = await createClient();
          void logDuplicateBatchRejection(supabase, venue.id, row.source || "other", "import", row, leadInputToRawIntake(row));
        }
        continue;
      }
      seenKeys.add(emailKey);
    }

    const eventDateNorm = normalizeImportDate(row.eventDate ?? "");
    if (!eventDateNorm.ok) {
      errors.push({ row: i + 1, message: eventDateNorm.message, kind: "error" });
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
      estimatedBudget: budgetNorm.value,
    };

    // Release Readiness Blocker #1 — find_or_create_relationship dedupes
    // the enduring Relationship, never the Lead/Opportunity row itself, so
    // a re-run import (or a CSV that already contains an active lead)
    // silently doubled the pipeline. Skipped, not silently created —
    // reported the same way a missing-field row already is.
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateLead(normalizedLead.email ?? "", normalizedLead.firstName, normalizedLead.lastName),
      "Skipped — matches an already-active lead",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      // Historical / CSV Import must not enroll lead_created sequences or
      // fire venue new-inquiry notifications — same contract as Migration
      // Center (createLead(..., "import", true)) and HQ createLeadForVenue.
      const result = await createLead(normalizedLead, "import", true);
      if (result.ok) {
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
  if (createdIds.length > 0) revalidatePath("/library/packages");
  return { imported: createdIds.length, errors, batchId };
}
