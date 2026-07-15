"use server";

import { revalidatePath } from "next/cache";

import { createClient_ } from "@/lib/clients/service";
import { DISPLAY_SHAPES } from "@/components/floor-plan/floor-plan-shapes";
import { extractDocxText, extractPdfText, parseExcelFile } from "@/lib/import/file-parsing";
import type { InventoryImportRow } from "@/lib/import/utils";
import { createCategory, createItem as createInventoryItem, getCategories } from "@/lib/inventory/service";
import { createLead, findActiveDuplicateLead } from "@/lib/leads/service";
import { proposeStructuredRows } from "@/lib/luv/import-assist";
import { createPackage } from "@/lib/packages/service";
import { createVendor } from "@/lib/vendors/service";
import type { ClientInput } from "@/lib/clients/types";
import type { InventoryItemInput, InventoryShape } from "@/lib/inventory/types";
import type { LeadInput } from "@/lib/leads/types";
import type { PackageInput } from "@/lib/packages/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { EntityType, ImportResult } from "@/lib/import/types";

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
  return { ok: true, headers: result.headers, rows: result.rows, assisted: true };
}

export async function importCouplesAction(rows: ClientInput[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }
    try {
      const result = await createClient_(row);
      if (result.ok) {
        imported++;
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  if (imported > 0) revalidatePath("/clients");
  return { imported, errors };
}

export async function importLeadsAction(rows: LeadInput[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }
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
      const result = await createLead(row);
      if (result.ok) {
        imported++;
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  if (imported > 0) revalidatePath("/leads");
  return { imported, errors };
}

export async function importVendorsAction(rows: VendorInput[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.businessName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: business name", kind: "skipped" });
      continue;
    }
    try {
      const result = await createVendor(row);
      if (result.ok) {
        imported++;
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  if (imported > 0) revalidatePath("/vendors");
  return { imported, errors };
}

function normalizeShape(raw: string): InventoryShape | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (DISPLAY_SHAPES as string[]).includes(v) ? (v as InventoryShape) : null;
}

export async function importInventoryAction(rows: InventoryImportRow[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  let imported = 0;

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
        imported++;
      } else {
        errors.push({ row: i + 1, message: "message" in result ? (result.message ?? "Unknown error") : "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  if (imported > 0) revalidatePath("/library/inventory");
  return { imported, errors };
}

export async function importPackagesAction(rows: PackageInput[]): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: package name", kind: "skipped" });
      continue;
    }
    try {
      const result = await createPackage(row);
      if (result.ok) {
        imported++;
      } else {
        const msg = "message" in result ? result.message : "errors" in result ? Object.values(result.errors ?? {}).join(", ") : "Unknown error";
        errors.push({ row: i + 1, message: msg ?? "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }
  if (imported > 0) revalidatePath("/library/packages");
  return { imported, errors };
}
