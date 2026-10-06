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
import { resolveSpaceId } from "@/lib/migration/resolve-refs";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";
import { createLeadForVenue, findActiveDuplicateLeadForVenue, leadIdentityKey, leadInputToRawIntake } from "@/lib/leads/service";
import { logDuplicateBatchRejection } from "@/lib/lead-intake/pipeline";
import { createVendorForVenue, findActiveDuplicateVendorForVenue } from "@/lib/vendors/service";
import {
  createItemForVenue, findActiveDuplicateInventoryItemForVenue,
  getCategoriesForVenue, createCategoryForVenue,
} from "@/lib/inventory/service";
import { createPackageForVenue, findActiveDuplicatePackageForVenue } from "@/lib/packages/service";
import { acceptCreatedImportRow, createImportBatchForVenue, finalizeImportBatch } from "@/lib/import/batches";
import { decideHistoricalImportDuplicate, haltUntrackedHistoricalImport } from "@/lib/import/historical-guard";
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
  const tracked = haltUntrackedHistoricalImport(
    venueId,
    await createImportBatchForVenue(admin, venueId, "couples", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId)),
  );
  if (!tracked.ok) return tracked.result;
  const batchId = tracked.batchId;
  const [{ count: spacesCount }, { data: rules }] = await Promise.all([
    admin.from("venue_spaces").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("is_active", true),
    admin.from("venue_capacity_rules").select("max_simultaneous_events").eq("venue_id", venueId)
      .maybeSingle<{ max_simultaneous_events: number }>(),
  ]);
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spacesCount ?? 0,
    hasCapacityRules: !!rules,
    maxSimultaneousEvents: rules?.max_simultaneous_events ?? 1,
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
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateClientForVenue(venueId, row.email ?? "", row.firstName, row.lastName),
      "Skipped — matches an already-active client",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const raw = row.spaceId.trim();
      let input = row;
      if (raw) {
        const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
        const resolved = await resolveSpaceId(admin, venueId, uuidLike ? raw : null, uuidLike ? null : raw);
        if (!resolved.ok) {
          errors.push({ row: i + 1, message: resolved.error, kind: "error" });
          continue;
        }
        input = { ...row, spaceId: resolved.spaceId ?? "" };
      }
      const result = await createClientForVenue(venueId, input);
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "couples",
          batchId,
          createdId: result.clientId,
          venueId,
          rowNumber: i + 1,
          client: admin,
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
  const tracked = haltUntrackedHistoricalImport(
    venueId,
    await createImportBatchForVenue(admin, venueId, "leads", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId)),
  );
  if (!tracked.ok) return tracked.result;
  const batchId = tracked.batchId;
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

    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateLeadForVenue(venueId, row.email ?? "", row.firstName, row.lastName),
      "Skipped — matches an already-active lead",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const result = await createLeadForVenue(venueId, row);
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "leads",
          batchId,
          createdId: result.leadId,
          venueId,
          rowNumber: i + 1,
          client: admin,
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
  const tracked = haltUntrackedHistoricalImport(
    venueId,
    await createImportBatchForVenue(admin, venueId, "vendors", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId)),
  );
  if (!tracked.ok) return tracked.result;
  const batchId = tracked.batchId;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.businessName?.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: business name", kind: "skipped" });
      continue;
    }
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateVendorForVenue(venueId, row.businessName, row.email ?? ""),
      "Skipped — matches a vendor already in this venue's directory",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const result = await createVendorForVenue(venueId, row);
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "vendors",
          batchId,
          createdId: result.vendorId,
          venueId,
          rowNumber: i + 1,
          client: admin,
        });
        if (accepted.accepted) createdIds.push(result.vendorId);
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
  const tracked = haltUntrackedHistoricalImport(
    venueId,
    await createImportBatchForVenue(admin, venueId, "inventory", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId)),
  );
  if (!tracked.ok) return tracked.result;
  const batchId = tracked.batchId;

  const existingCategories = await getCategoriesForVenue(venueId);
  const categoryIdByName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: item name", kind: "skipped" });
      continue;
    }
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicateInventoryItemForVenue(venueId, row.name),
      "Skipped — matches an item already in this venue's inventory",
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
        const accepted = await acceptCreatedImportRow({
          entityType: "inventory",
          batchId,
          createdId: result.itemId,
          venueId,
          rowNumber: i + 1,
          client: admin,
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
  const tracked = haltUntrackedHistoricalImport(
    venueId,
    await createImportBatchForVenue(admin, venueId, "packages", sourceLabel ?? null, rows.length, actor.userId, await engagementIdFor(venueId)),
  );
  if (!tracked.ok) return tracked.result;
  const batchId = tracked.batchId;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name.trim()) {
      errors.push({ row: i + 1, message: "Missing required field: package name", kind: "skipped" });
      continue;
    }
    const dup = await decideHistoricalImportDuplicate(
      i + 1,
      () => findActiveDuplicatePackageForVenue(venueId, row.name),
      "Skipped — matches a package this venue already offers",
    );
    if (dup.action !== "create") {
      errors.push(dup.error);
      continue;
    }
    try {
      const result = await createPackageForVenue(venueId, row);
      if (result.ok) {
        const accepted = await acceptCreatedImportRow({
          entityType: "packages",
          batchId,
          createdId: result.packageId,
          venueId,
          rowNumber: i + 1,
          client: admin,
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
  await finalizeImportBatch(batchId, { imported: createdIds.length, skipped, errors: errors.length - skipped }, admin);
  if (createdIds.length > 0) revalidatePath(`/admin/onboarding/${venueId}`);
  return { imported: createdIds.length, errors, batchId };
}
