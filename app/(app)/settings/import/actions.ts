"use server";

import { revalidatePath } from "next/cache";

import { createClient_ } from "@/lib/clients/service";
import { extractDocxText, extractPdfText, parseExcelFile } from "@/lib/import/file-parsing";
import { createLead } from "@/lib/leads/service";
import { proposeStructuredRows } from "@/lib/luv/import-assist";
import { createVendor } from "@/lib/vendors/service";
import type { ClientInput } from "@/lib/clients/types";
import type { LeadInput } from "@/lib/leads/types";
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
