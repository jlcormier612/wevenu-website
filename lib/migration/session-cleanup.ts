/**
 * Reviewable import-scoped cleanup for Migration Center sessions.
 *
 * Attribution is ONLY via migration_records.created_entity_id for this session.
 * Never uses name/email/timestamp matching. Never calls rollbackImportBatch.
 *
 * Owner-control policy:
 * - Outcome A (eligible): safe automatic delete after confirm.
 * - Outcome B (overridable): warning with consequences; owner may opt in.
 * - Outcome C (blocked): hard stop with plain-language reason + next step.
 *   Hard blocks: financial integrity, tour hard-delete guard, seating history
 *   on floor plans, missing delete path, unauthorized/cross-tenant (via
 *   existing venue-scoped delete actions).
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import * as repo from "@/lib/migration/repository";
import { deleteClientRecord, previewDeleteClient } from "@/lib/records/delete-record";
import { deleteLeadRecord, previewDeleteLead } from "@/lib/records/delete-record";
import { deleteVendor_ } from "@/lib/vendors/service";
import { deletePackage_ } from "@/lib/packages/service";
import { deleteBlock_, deleteHold_ } from "@/lib/availability/service";
import { deleteTourAppointment } from "@/lib/tours/service";
import { canHardDeleteTourAppointment } from "@/lib/tours/delete-guard";
import { deleteEntry } from "@/lib/timeline/service";
import * as vendorsRepo from "@/lib/vendors/repository";
import * as documentsRepo from "@/lib/documents/repository";
import type { MigrationEntityType, MigrationRecord } from "@/lib/migration/types";

export type CleanupDisposition = "eligible" | "overridable" | "blocked" | "already_gone";

export type CleanupTarget = {
  recordId: string;
  entityType: MigrationEntityType;
  entityId: string;
  disposition: CleanupDisposition;
  reason: string;
  nextStep: string;
  label: string;
  consequences: string[];
};

export type CleanupPreview = {
  sessionId: string;
  venueId: string;
  targets: CleanupTarget[];
  eligibleCount: number;
  overridableCount: number;
  blockedCount: number;
  alreadyGoneCount: number;
  warnings: string[];
};

export type CleanupItemResult = {
  recordId: string;
  entityType: MigrationEntityType;
  entityId: string;
  label: string;
  outcome: "deleted" | "blocked" | "skipped" | "already_gone" | "failed";
  message: string;
};

export type CleanupResult = {
  ok: true;
  deleted: number;
  blocked: number;
  skipped: number;
  alreadyGone: number;
  failed: number;
  unresolved: number;
  summary: string;
  items: CleanupItemResult[];
} | { ok: false; message: string };

/** Leaf / child types before parents. Events have no standalone delete. */
const DELETE_ORDER: MigrationEntityType[] = [
  "guest_list",
  "timeline_entry",
  "event_vendor_assignment",
  "document",
  "floor_plan", // created_entity_id is the Documents SoR row from floor-plan-commit
  "tour",
  "date_hold",
  "calendar_block",
  "package",
  "vendor",
  "lead",
  "client",
];

const TOUCH_BUFFER_MS = 2000;

const ENTITY_TABLE: Partial<Record<MigrationEntityType, string>> = {
  client: "clients",
  lead: "leads",
  vendor: "vendors",
  package: "packages",
  calendar_block: "calendar_blocks",
  date_hold: "date_holds",
  tour: "tour_appointments",
  guest_list: "couple_guests",
  event_vendor_assignment: "event_vendor_assignments",
  timeline_entry: "timeline_entries",
  document: "documents",
  event: "events",
  // MC floor_plan commits return the document id (see floor-plan-commit.ts).
  floor_plan: "documents",
};

function labelFor(record: MigrationRecord): string {
  const p = record.normalizedPayload ?? {};
  const name =
    (p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : null)
    ?? (p.businessName as string | null)
    ?? (p.name as string | null)
    ?? (p.title as string | null)
    ?? (p.fileName as string | null)
    ?? record.sourceRowRef
    ?? record.createdEntityId?.slice(0, 8)
    ?? "record";
  return String(name);
}

function target(
  record: MigrationRecord,
  disposition: CleanupDisposition,
  reason: string,
  nextStep: string,
  consequences: string[] = [],
): CleanupTarget {
  return {
    recordId: record.id,
    entityType: record.targetEntityType,
    entityId: record.createdEntityId!,
    disposition,
    reason,
    nextStep,
    label: labelFor(record),
    consequences,
  };
}

async function wasEditedSinceCommit(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  entityType: MigrationEntityType,
  entityId: string,
  committedAt: string | null,
): Promise<boolean> {
  if (!committedAt) return true;
  const table = ENTITY_TABLE[entityType];
  if (!table) return true;
  const baseline = new Date(new Date(committedAt).getTime() + TOUCH_BUFFER_MS).toISOString();

  if (entityType === "vendor") {
    const { data } = await admin.from("venue_vendor_relationships")
      .select("updated_at, created_at")
      .eq("venue_id", venueId)
      .eq("vendor_id", entityId)
      .maybeSingle<{ updated_at: string; created_at: string }>();
    if (!data) return false;
    return data.updated_at > baseline;
  }

  const { data } = await admin.from(table)
    .select("updated_at, created_at")
    .eq("id", entityId)
    .eq("venue_id", venueId)
    .maybeSingle<{ updated_at: string; created_at: string }>();
  if (!data) return false;
  return data.updated_at > baseline;
}

async function entityExists(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  entityType: MigrationEntityType,
  entityId: string,
): Promise<boolean> {
  const table = ENTITY_TABLE[entityType];
  if (!table) return false;
  if (entityType === "vendor") {
    const { data } = await admin.from("venue_vendor_relationships")
      .select("id").eq("venue_id", venueId).eq("vendor_id", entityId).maybeSingle();
    return !!data;
  }
  const { data } = await admin.from(table)
    .select("id").eq("id", entityId).eq("venue_id", venueId).maybeSingle();
  return !!data;
}

/** True when any floor_plans row using this background document has seating history. */
async function floorPlanDocumentSeatingBlocks(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  documentId: string,
): Promise<boolean> {
  const { data: plans } = await admin.from("floor_plans")
    .select("id")
    .eq("venue_id", venueId)
    .eq("background_document_id", documentId);
  const planIds = ((plans ?? []) as { id: string }[]).map((p) => p.id);
  if (planIds.length === 0) return false;
  const [{ count: a }, { count: s }, { count: d }] = await Promise.all([
    admin.from("guest_seat_assignments").select("guest_id", { count: "exact", head: true }).in("floor_plan_id", planIds),
    admin.from("seating_submissions").select("id", { count: "exact", head: true }).in("floor_plan_id", planIds),
    admin.from("seating_delegations").select("id", { count: "exact", head: true }).in("floor_plan_id", planIds),
  ]);
  return (a ?? 0) > 0 || (s ?? 0) > 0 || (d ?? 0) > 0;
}

function isFinancialBlockMessage(message: string): boolean {
  return /signed contract|collected payments|financial/i.test(message);
}

export async function previewImportSessionCleanup(sessionId: string): Promise<
  { ok: true; preview: CleanupPreview } | { ok: false; message: string }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };

  const session = await repo.getSession(supabase, venue.id, sessionId);
  if (!session) return { ok: false, message: "Migration session not found." };
  if (!["committed", "partially_committed", "failed"].includes(session.status)) {
    return {
      ok: false,
      message: "Cleanup is only available after an import has been committed (or partly committed).",
    };
  }

  const records = (await repo.listRecords(supabase, sessionId, "committed"))
    .filter((r) => !!r.createdEntityId);
  const admin = createAdminClient();
  const targets: CleanupTarget[] = [];
  const warnings: string[] = [];

  for (const record of records) {
    const entityId = record.createdEntityId!;
    const entityType = record.targetEntityType;

    if (entityType === "active_commitment") {
      targets.push(target(
        record,
        "blocked",
        "This import created financial records (Event Order, invoice, or payment schedule) that must stay for your books.",
        "Review those records on the client. You can correct details there; deleting payment history from Import cleanup is not available.",
      ));
      continue;
    }

    if (entityType === "event") {
      targets.push(target(
        record,
        "blocked",
        "Events are not removed on their own from Import cleanup.",
        "Delete the related Client in this cleanup if it was also imported and is eligible, or remove planning records from the client workspace.",
      ));
      continue;
    }

    if (entityType === "payment" || entityType === "key_date") {
      targets.push(target(
        record,
        "blocked",
        `This "${entityType}" row cannot be removed through Import cleanup.`,
        "Open the related client or settings screen and use the supported edit or remove action there.",
      ));
      continue;
    }

    if (entityType === "floor_plan") {
      const exists = await entityExists(admin, venue.id, "floor_plan", entityId);
      if (!exists) {
        targets.push(target(record, "already_gone", "This floor plan file is already gone.", "Nothing more to do."));
        continue;
      }
      if (await floorPlanDocumentSeatingBlocks(admin, venue.id, entityId)) {
        targets.push(target(
          record,
          "blocked",
          "A floor plan that uses this imported file has seating assignments, submissions, or assistance history.",
          "Resolve seating first in Floor plans, then try cleanup again. Seating history is never deleted silently.",
        ));
        continue;
      }
      const edited = await wasEditedSinceCommit(admin, venue.id, "floor_plan", entityId, record.committedAt);
      targets.push(target(
        record,
        "overridable",
        edited
          ? "This imported floor plan file has changed since import. Deleting it removes the file and later changes."
          : "This floor plan file was created by this import. Deleting it removes the file from your library.",
        "Select it below if you want it removed, then confirm.",
        [
          "The imported file (document) will be removed.",
          "Space templates or event plans that used this file may need a new background.",
        ],
      ));
      continue;
    }

    if (!DELETE_ORDER.includes(entityType)) {
      targets.push(target(
        record,
        "blocked",
        `Import cleanup does not support removing "${entityType}" yet.`,
        "Use the record’s own Delete action in the product, or leave it for a follow-up.",
      ));
      continue;
    }

    const exists = await entityExists(admin, venue.id, entityType, entityId);
    if (!exists) {
      targets.push(target(record, "already_gone", "This record is already gone.", "Nothing more to do."));
      continue;
    }

    // Financial / product hard gates first (not overridable)
    if (entityType === "client") {
      const preview = await previewDeleteClient(entityId);
      if (!preview.ok) {
        targets.push(target(
          record,
          "blocked",
          isFinancialBlockMessage(preview.message)
            ? "This client is linked to a signed contract or collected payments that must be preserved."
            : preview.message,
          isFinancialBlockMessage(preview.message)
            ? "Keep this client for your books. Fix duplicates by deleting the extra inquiry instead of erasing paid history."
            : "Resolve the issue named above, then try again.",
        ));
        continue;
      }
    }
    if (entityType === "lead") {
      const preview = await previewDeleteLead(entityId);
      if (!preview.ok) {
        targets.push(target(record, "blocked", preview.message, "Resolve the issue named above, then try again."));
        continue;
      }
    }
    if (entityType === "tour") {
      const { data: tour } = await admin.from("tour_appointments")
        .select("lead_id, contact_email, contact_name")
        .eq("id", entityId)
        .eq("venue_id", venue.id)
        .maybeSingle<{ lead_id: string | null; contact_email: string | null; contact_name: string | null }>();
      if (tour) {
        const guard = canHardDeleteTourAppointment({
          leadId: tour.lead_id,
          contactEmail: tour.contact_email,
          contactName: tour.contact_name,
        });
        if (!guard.allowed) {
          targets.push(target(
            record,
            "blocked",
            "This tour is linked to a customer record, so hard delete is not available from Import cleanup.",
            "Archive the tour in Tours, or delete the linked Lead from this cleanup if you no longer need either.",
          ));
          continue;
        }
      }
    }

    const edited = await wasEditedSinceCommit(admin, venue.id, entityType, entityId, record.committedAt);
    if (edited) {
      targets.push(target(
        record,
        "overridable",
        "This record has changed since it was imported. Deleting it will also remove those later changes.",
        "Select it below if you no longer need it, then confirm.",
        ["Any edits made after import will be discarded with this record."],
      ));
      continue;
    }

    targets.push(target(
      record,
      "eligible",
      "Created by this import and unchanged — ready to remove.",
      "Included when you confirm cleanup.",
    ));
  }

  const eligibleCount = targets.filter((t) => t.disposition === "eligible").length;
  const overridableCount = targets.filter((t) => t.disposition === "overridable").length;
  const blockedCount = targets.filter((t) => t.disposition === "blocked").length;
  const alreadyGoneCount = targets.filter((t) => t.disposition === "already_gone").length;

  if (overridableCount > 0) {
    warnings.push(
      `${overridableCount} record${overridableCount === 1 ? "" : "s"} need your decision before they can be removed.`,
    );
  }
  if (blockedCount > 0) {
    warnings.push(
      `${blockedCount} record${blockedCount === 1 ? "" : "s"} cannot be deleted from Import cleanup — see the reason and next step for each.`,
    );
  }
  warnings.push(
    "This is not a full session Undo. Only records attributed to this import are considered, and blocked records stay until you handle them another way.",
  );

  return {
    ok: true,
    preview: {
      sessionId,
      venueId: venue.id,
      targets,
      eligibleCount,
      overridableCount,
      blockedCount,
      alreadyGoneCount,
      warnings,
    },
  };
}

/**
 * Domain delete helpers often type failure `message` as optional.
 * Cleanup outcomes require a non-empty string — never suppress failure as success.
 */
export function asCleanupDeleteResult(
  result: { ok: true } | { ok: false; message?: string },
  fallback: string,
): { ok: true } | { ok: false; message: string } {
  if (result.ok) return { ok: true };
  const message = typeof result.message === "string" ? result.message.trim() : "";
  return { ok: false, message: message.length > 0 ? message : fallback };
}

async function deleteOne(
  venueId: string,
  entityType: MigrationEntityType,
  entityId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  switch (entityType) {
    case "client":
      return deleteClientRecord(entityId);
    case "lead":
      return deleteLeadRecord(entityId);
    case "vendor":
      return asCleanupDeleteResult(await deleteVendor_(entityId), "Could not remove this vendor.");
    case "package":
      return asCleanupDeleteResult(await deletePackage_(entityId), "Could not remove this package.");
    case "calendar_block":
      return asCleanupDeleteResult(await deleteBlock_(entityId), "Could not remove this calendar block.");
    case "date_hold":
      return asCleanupDeleteResult(await deleteHold_(entityId), "Could not remove this date hold.");
    case "tour":
      return asCleanupDeleteResult(await deleteTourAppointment(entityId), "Could not remove this tour.");
    case "timeline_entry":
      return asCleanupDeleteResult(await deleteEntry(entityId), "Could not remove this timeline entry.");
    case "event_vendor_assignment": {
      const admin = createAdminClient();
      return vendorsRepo.deleteVendorAssignment(admin as never, venueId, entityId);
    }
    case "guest_list": {
      const admin = createAdminClient();
      const { error, count } = await admin.from("couple_guests")
        .delete({ count: "exact" })
        .eq("id", entityId)
        .eq("venue_id", venueId);
      if (error) return { ok: false, message: error.message };
      if ((count ?? 0) === 0) return { ok: false, message: "Guest not found." };
      return { ok: true };
    }
    case "document":
    case "floor_plan": {
      // floor_plan MC attribution is the Documents SoR id from commitFloorPlanImport.
      const admin = createAdminClient();
      try {
        await documentsRepo.deleteDocument(admin as never, venueId, entityId);
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Could not delete document." };
      }
    }
    default:
      return { ok: false, message: `No automatic delete for ${entityType}.` };
  }
}

/**
 * Deletes eligible records plus any overridable records the owner selected.
 * Hard-blocked records are never deleted. Re-checks gates at execute time.
 */
export async function executeImportSessionCleanup(
  sessionId: string,
  opts: { confirmed: boolean; overrideRecordIds?: string[] },
): Promise<CleanupResult> {
  if (!opts.confirmed) {
    return { ok: false, message: "Confirmation required before cleanup." };
  }
  const previewed = await previewImportSessionCleanup(sessionId);
  if (!previewed.ok) return previewed;

  const overrideSet = new Set(opts.overrideRecordIds ?? []);
  const { preview } = previewed;
  const items: CleanupItemResult[] = [];
  let deleted = 0;
  let blocked = 0;
  let skipped = 0;
  let alreadyGone = 0;
  let failed = 0;

  const ordered = [...preview.targets].sort((a, b) => {
    const ai = DELETE_ORDER.indexOf(a.entityType);
    const bi = DELETE_ORDER.indexOf(b.entityType);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  for (const t of ordered) {
    const base = {
      recordId: t.recordId, entityType: t.entityType, entityId: t.entityId, label: t.label,
    };

    if (t.disposition === "already_gone") {
      alreadyGone++;
      items.push({ ...base, outcome: "already_gone", message: t.reason });
      continue;
    }

    if (t.disposition === "blocked") {
      blocked++;
      items.push({ ...base, outcome: "blocked", message: `${t.reason} ${t.nextStep}` });
      continue;
    }

    if (t.disposition === "overridable" && !overrideSet.has(t.recordId)) {
      skipped++;
      items.push({
        ...base,
        outcome: "skipped",
        message: "Left in place — you did not choose to remove this warned record.",
      });
      continue;
    }

    // eligible OR overridable+selected — re-check hard gates
    const admin = createAdminClient();
    const exists = await entityExists(admin, preview.venueId, t.entityType, t.entityId);
    if (!exists) {
      alreadyGone++;
      items.push({ ...base, outcome: "already_gone", message: "Already removed before cleanup ran." });
      continue;
    }

    if (t.entityType === "client") {
      const previewClient = await previewDeleteClient(t.entityId);
      if (!previewClient.ok) {
        blocked++;
        items.push({ ...base, outcome: "blocked", message: previewClient.message });
        continue;
      }
    }
    if (t.entityType === "lead") {
      const previewLead = await previewDeleteLead(t.entityId);
      if (!previewLead.ok) {
        blocked++;
        items.push({ ...base, outcome: "blocked", message: previewLead.message });
        continue;
      }
    }
    if (t.entityType === "floor_plan" && await floorPlanDocumentSeatingBlocks(admin, preview.venueId, t.entityId)) {
      blocked++;
      items.push({
        ...base,
        outcome: "blocked",
        message: "A linked floor plan gained seating history before cleanup ran — resolve seating first.",
      });
      continue;
    }
    if (t.entityType === "tour") {
      const { data: tour } = await admin.from("tour_appointments")
        .select("lead_id, contact_email, contact_name")
        .eq("id", t.entityId)
        .eq("venue_id", preview.venueId)
        .maybeSingle<{ lead_id: string | null; contact_email: string | null; contact_name: string | null }>();
      if (tour) {
        const guard = canHardDeleteTourAppointment({
          leadId: tour.lead_id,
          contactEmail: tour.contact_email,
          contactName: tour.contact_name,
        });
        if (!guard.allowed) {
          blocked++;
          items.push({ ...base, outcome: "blocked", message: guard.reason });
          continue;
        }
      }
    }

    const result = await deleteOne(preview.venueId, t.entityType, t.entityId);
    if (result.ok) {
      deleted++;
      items.push({ ...base, outcome: "deleted", message: "Removed." });
    } else {
      failed++;
      items.push({ ...base, outcome: "failed", message: result.message });
    }
  }

  const unresolved = blocked + skipped + failed;
  const summary = unresolved === 0
    ? `Cleanup finished. ${deleted} record${deleted === 1 ? "" : "s"} removed.`
    : `Cleanup completed for ${deleted} record${deleted === 1 ? "" : "s"}. ${unresolved} record${unresolved === 1 ? "" : "s"} remain because they need additional review or failed. Nothing was deleted for those remaining records.`;

  return {
    ok: true,
    deleted,
    blocked,
    skipped,
    alreadyGone,
    failed,
    unresolved,
    summary,
    items,
  };
}
