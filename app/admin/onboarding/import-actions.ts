"use server";

/**
 * White-Glove Migration (Hospitality Success Platform §2.2a step 4) — the
 * staff-facing counterpart to app/(app)/settings/import/actions.ts. Same
 * wizard UI (components/settings/import-wizard.tsx), same validation, same
 * duplicate detection, same batch tracking — the only difference is the
 * venue is an explicit parameter (an HQ admin has no venue of their own)
 * and every write goes through createAdminClient() (service_role), gated
 * by requireAdminUser() inside each *ForVenue service function this calls.
 * "One migration engine, one data model, two entry points" — not a second
 * implementation.
 */
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/integrations/supabase/admin";
import { requireAdminUser } from "@/lib/hq/crm-service";
import { getOnboardingEngagement } from "@/lib/hq/onboarding-service";
import { createClientForVenue, findActiveDuplicateClientForVenue } from "@/lib/clients/service";
import { createLeadForVenue, findActiveDuplicateLeadForVenue, leadIdentityKey, leadInputToRawIntake } from "@/lib/leads/service";
import { logDuplicateBatchRejection } from "@/lib/lead-intake/pipeline";
import { createVendorForVenue, findActiveDuplicateVendorForVenue } from "@/lib/vendors/service";
import {
  createItemForVenue, findActiveDuplicateInventoryItemForVenue,
  getCategoriesForVenue, createCategoryForVenue,
} from "@/lib/inventory/service";
import { createPackageForVenue, findActiveDuplicatePackageForVenue } from "@/lib/packages/service";
import { createImportBatchForVenue, finalizeImportBatch, stampImportBatch } from "@/lib/import/batches";
import type { ClientInput } from "@/lib/clients/types";
import type { InventoryItemInput, InventoryShape } from "@/lib/inventory/types";
import type { LeadInput } from "@/lib/leads/types";
import type { PackageInput } from "@/lib/packages/types";
import type { VendorInput } from "@/lib/vendors/types";
import type { InventoryImportRow } from "@/lib/import/utils";
import type { ImportResult } from "@/lib/import/types";
import { DISPLAY_SHAPES } from "@/components/floor-plan/floor-plan-shapes";

function normalizeShape(raw: string): InventoryShape | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (DISPLAY_SHAPES as string[]).includes(v) ? (v as InventoryShape) : null;
}

async function engagementIdFor(venueId: string): Promise<string | null> {
  const engagement = await getOnboardingEngagement(venueId);
  return engagement?.id ?? null;
}

export async function importCouplesForVenueAction(venueId: string, rows: ClientInput[], sourceLabel?: string): Promise<ImportResult> {
  const actor = await requireAdminUser();
  if (!actor) return { imported: 0, errors: [{ row: 0, message: "Not signed in as an HQ admin.", kind: "error" }], batchId: null };

  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const admin = createAdminClient();
  const batchId = await createImportBatchForVenue(admin, venueId, "couples", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicateClientForVenue(venueId, row.email ?? "", row.firstName, row.lastName);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches an already-active client", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createClientForVenue(venueId, row);
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

  await stampImportBatch("couples", batchId, createdIds, admin);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped }, admin);
  if (createdIds.length > 0) revalidatePath(`/admin/onboarding/${venueId}`);
  return { imported: createdIds.length, errors, batchId };
}

export async function importLeadsForVenueAction(venueId: string, rows: LeadInput[], sourceLabel?: string): Promise<ImportResult> {
  const actor = await requireAdminUser();
  if (!actor) return { imported: 0, errors: [{ row: 0, message: "Not signed in as an HQ admin.", kind: "error" }], batchId: null };

  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const admin = createAdminClient();
  const batchId = await createImportBatchForVenue(admin, venueId, "leads", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId));
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required fields: first name, last name", kind: "skipped" });
      continue;
    }

    // Migration Center §2.1 item 3 (2026-07-22) — see the identical check
    // in app/(app)/settings/import/actions.ts's importLeadsAction for the
    // full rationale.
    const key = leadIdentityKey(row.email, row.firstName, row.lastName);
    if (seenKeys.has(key)) {
      errors.push({ row: i + 1, message: "Skipped — duplicate of an earlier row in this same file", kind: "skipped" });
      // Same source resolution createLeadCore already uses — see the
      // identical comment in app/(app)/settings/import/actions.ts.
      void logDuplicateBatchRejection(admin, venueId, row.source || "other", "import", row, leadInputToRawIntake(row));
      continue;
    }
    seenKeys.add(key);

    try {
      const duplicate = await findActiveDuplicateLeadForVenue(venueId, row.email ?? "", row.firstName, row.lastName);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches an already-active lead", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createLeadForVenue(venueId, row);
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

  await stampImportBatch("leads", batchId, createdIds, admin);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped }, admin);
  if (createdIds.length > 0) revalidatePath(`/admin/onboarding/${venueId}`);
  return { imported: createdIds.length, errors, batchId };
}

export async function importVendorsForVenueAction(venueId: string, rows: VendorInput[], sourceLabel?: string): Promise<ImportResult> {
  const actor = await requireAdminUser();
  if (!actor) return { imported: 0, errors: [{ row: 0, message: "Not signed in as an HQ admin.", kind: "error" }], batchId: null };

  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const admin = createAdminClient();
  const batchId = await createImportBatchForVenue(admin, venueId, "vendors", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.businessName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: business name", kind: "skipped" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicateVendorForVenue(venueId, row.businessName, row.email ?? "");
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches a vendor already in this venue's directory", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createVendorForVenue(venueId, row);
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

  await stampImportBatch("vendors", batchId, createdIds, admin);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped }, admin);
  if (createdIds.length > 0) revalidatePath(`/admin/onboarding/${venueId}`);
  return { imported: createdIds.length, errors, batchId };
}

export async function importInventoryForVenueAction(venueId: string, rows: InventoryImportRow[], sourceLabel?: string): Promise<ImportResult> {
  const actor = await requireAdminUser();
  if (!actor) return { imported: 0, errors: [{ row: 0, message: "Not signed in as an HQ admin.", kind: "error" }], batchId: null };

  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const admin = createAdminClient();
  const batchId = await createImportBatchForVenue(admin, venueId, "inventory", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId));

  const existingCategories = await getCategoriesForVenue(venueId);
  const categoryIdByName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: item name", kind: "skipped" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicateInventoryItemForVenue(venueId, row.name);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches an item already in this venue's inventory", kind: "skipped" });
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
          const created = await createCategoryForVenue(venueId, categoryName);
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
        availableForFloorPlans: true,
      };
      const result = await createItemForVenue(venueId, input);
      if (result.ok) {
        createdIds.push(result.itemId);
      } else {
        errors.push({ row: i + 1, message: "message" in result ? (result.message ?? "Unknown error") : "Unknown error", kind: "error" });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "Unknown error", kind: "error" });
    }
  }

  await stampImportBatch("inventory", batchId, createdIds, admin);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped }, admin);
  if (createdIds.length > 0) revalidatePath(`/admin/onboarding/${venueId}`);
  return { imported: createdIds.length, errors, batchId };
}

export async function importPackagesForVenueAction(venueId: string, rows: PackageInput[], sourceLabel?: string): Promise<ImportResult> {
  const actor = await requireAdminUser();
  if (!actor) return { imported: 0, errors: [{ row: 0, message: "Not signed in as an HQ admin.", kind: "error" }], batchId: null };

  const errors: ImportResult["errors"] = [];
  const createdIds: string[] = [];
  const admin = createAdminClient();
  const batchId = await createImportBatchForVenue(admin, venueId, "packages", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: package name", kind: "skipped" });
      continue;
    }
    try {
      const duplicate = await findActiveDuplicatePackageForVenue(venueId, row.name);
      if (duplicate) {
        errors.push({ row: i + 1, message: "Skipped — matches a package this venue already offers", kind: "skipped" });
        continue;
      }
    } catch {
      // Duplicate check failing must never block a legitimate import.
    }
    try {
      const result = await createPackageForVenue(venueId, row);
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

  await stampImportBatch("packages", batchId, createdIds, admin);
  const skipped = errors.filter((e) => e.kind === "skipped").length;
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped }, admin);
  if (createdIds.length > 0) revalidatePath(`/admin/onboarding/${venueId}`);
  return { imported: createdIds.length, errors, batchId };
}
