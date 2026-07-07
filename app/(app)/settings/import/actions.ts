"use server";

import { revalidatePath } from "next/cache";

import { createClient_ } from "@/lib/clients/service";
import { createLead } from "@/lib/leads/service";
import { createVendor } from "@/lib/vendors/service";
import type { ClientInput } from "@/lib/clients/types";
import type { LeadInput } from "@/lib/leads/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { ImportResult } from "@/lib/import/types";

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
