"use server";

import { revalidatePath } from "next/cache";

import { createClient_, findActiveDuplicateClient } from "@/lib/clients/service";
import { resolveSpaceId } from "@/lib/migration/resolve-refs";
import { DISPLAY_SHAPES } from "@/components/floor-plan/floor-plan-shapes";
import { createImportBatch, finalizeImportBatch, getImportBatches, rollbackImportBatch, stampImportBatch, type RollbackResult } from "@/lib/import/batches";
import { extractDocxText, extractPdfText, parseExcelFile } from "@/lib/import/file-parsing";
import type { InventoryImportRow } from "@/lib/import/utils";
import { createCategory, createItem as createInventoryItem, findActiveDuplicateInventoryItem, getCategories } from "@/lib/inventory/service";
import { createLead, findActiveDuplicateLead, leadIdentityKey, leadInputToRawIntake } from "@/lib/leads/service";
import { logDuplicateBatchRejection } from "@/lib/lead-intake/pipeline";
import { proposeFieldMapping, proposeStructuredRows } from "@/lib/luv/import-assist";
import { createPackage, findActiveDuplicatePackage } from "@/lib/packages/service";
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
  const batchId = venue ? await createImportBatch(venue.id, "couples", sourceLabel ?? null, rows.length) : null;
  const spaces = await getSpaces();
  const capacityRules = await getCapacityRules();
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spaces.length,
    hasCapacityRules: capacityRules != null,
    maxSimultaneousEvents: capacityRules?.maxSimultaneousEvents ?? null,
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }
    if (!cutover.readyForDatedEvents && row.eventDate?.trim()) {
      errors.push({ row: i + 1, message: cutover.message ?? "Add Event Spaces before importing dated Events.", kind: "error" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicateClient(row.email ?? "", row.firstName, row.lastName);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches an already-active client", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const spaced = await withResolvedSpace(row);
      if (!spaced.ok) {
        errors.push({ row: i + 1, message: spaced.message, kind: "error" });
        continue;
      }
      const result = await createClient_(spaced.input);
      if (result.ok) {
        createdIds.push(result.clientId);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }

  await stampImportBatch("couples", batchId, createdIds);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  if (createdIds.length > 0) revalidatePath("/clients");
  return { imported: createdIds.length, errors, batchId };
}

export async function importLeadsAction(rows: LeadInput[], sourceLabel?: string): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const batchId = venue ? await createImportBatch(venue.id, "leads", sourceLabel ?? null, rows.length) : null;
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }

    // Migration Center §2.1 item 3 (2026-07-22) — a within-file duplicate
    // (two rows in this same CSV describing the same person), distinct
    // from the against-the-database check below. Checked first: once a
    // row's identity has been seen once in this run, every later
    // occurrence in the same file is a batch duplicate regardless of what
    // happened to the first one.
    const key = leadIdentityKey(row.email, row.firstName, row.lastName);
    if (seenKeys.has(key)) {
      errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file", kind: "skipped" });
      if (venue) {
        const supabase = await createClient();
        // Same source resolution createLeadCore already uses for a real
        // create — lead_intake_attempts.source is a foreign key into the
        // registered lead_sources vocabulary, not a free-text "csv_import"
        // label.
        void logDuplicateBatchRejection(supabase, venue.id, row.source || "other", "import", row, leadInputToRawIntake(row));
      }
      continue;
    }
    seenKeys.add(key);

    // Release Readiness Blocker #1 — find_or_create_relationship dedupes
    // the enduring Relationship, never the Lead/Opportunity row itself, so
    // a re-run import (or a CSV that already contains an active lead)
    // silently doubled the pipeline. Skipped, not silently created —
    // reported the same way a missing-field row already is.
    try {
      const duplicate = await findActiveDuplicateLead(row.email ?? "", row.firstName, row.lastName);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches an already-active lead", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createLead(row, "import");
      if (result.ok) {
        createdIds.push(result.leadId);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }

  await stampImportBatch("leads", batchId, createdIds);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  if (createdIds.length > 0) revalidatePath("/leads");
  return { imported: createdIds.length, errors, batchId };
}

export async function importVendorsAction(rows: VendorInput[], sourceLabel?: string): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const batchId = venue ? await createImportBatch(venue.id, "vendors", sourceLabel ?? null, rows.length) : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.businessName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: business name", kind: "skipped" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicateVendor(row.businessName, row.email ?? "");
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches a vendor already in your directory", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createVendor(row);
      if (result.ok) {
        createdIds.push(result.vendorId);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }

  // Note: stamping import_batch_id on vendors stamps the *global* vendor
  // profile row, not the venue relationship — vendors has no venue_id of
  // its own (confirmed live). Good enough for "which import created this
  // profile"; rollback for vendors specifically is scoped out below since
  // deleting a global vendor profile could affect another venue that also
  // claimed it — see the caveat on rollbackImportBatch's vendor handling.
  await stampImportBatch("vendors", batchId, createdIds);
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
  const batchId = venue ? await createImportBatch(venue.id, "inventory", sourceLabel ?? null, rows.length) : null;

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
    try {
      const duplicate = await findActiveDuplicateInventoryItem(row.name);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches an item already in your inventory", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
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
        quantityAvailable: parseInt(row.quantityAvailable, 10) || 0,
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
        createdIds.push(result.itemId);
      } else {
        errors.push({ row: i + 1, message: "message" in result ? (result.message ?? "Unknown error") : "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }

  await stampImportBatch("inventory", batchId, createdIds);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  if (createdIds.length > 0) revalidatePath("/library/inventory");
  return { imported: createdIds.length, errors, batchId };
}

export async function importPackagesAction(rows: PackageInput[], sourceLabel?: string): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const venue = await getCurrentVenue();
  const batchId = venue ? await createImportBatch(venue.id, "packages", sourceLabel ?? null, rows.length) : null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: package name", kind: "skipped" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicatePackage(row.name);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches a package you already offer", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createPackage(row);
      if (result.ok) {
        createdIds.push(result.packageId);
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }

  await stampImportBatch("packages", batchId, createdIds);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped });
  if (createdIds.length > 0) revalidatePath("/library/packages");
  return { imported: createdIds.length, errors, batchId };
}
