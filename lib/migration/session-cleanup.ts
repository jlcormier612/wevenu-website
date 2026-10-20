/**
 * Reviewable import-scoped cleanup for Migration Center sessions.
 *
 * Attribution is ONLY via migration_records.created_entity_id for this session.
 * Never uses name/email/timestamp matching. Never calls rollbackImportBatch
 * (unsafe after Active Commitment / financials).
 *
 * Eligible deletes use existing product delete gates. Financial, edited,
 * unsupported, or missing records are flagged for manual review — never
 * silently skipped as success.
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

export type CleanupDisposition = "eligible" | "review" | "already_gone";

export type CleanupTarget = {
  recordId: string;
  entityType: MigrationEntityType;
  entityId: string;
  disposition: CleanupDisposition;
  reason: string;
  label: string;
};

export type CleanupPreview = {
  sessionId: string;
  venueId: string;
  targets: CleanupTarget[];
  eligibleCount: number;
  reviewCount: number;
  alreadyGoneCount: number;
  warnings: string[];
};

export type CleanupItemResult = {
  recordId: string;
  entityType: MigrationEntityType;
  entityId: string;
  outcome: "deleted" | "review" | "already_gone" | "failed";
  message: string;
};

export type CleanupResult = {
  ok: true;
  deleted: number;
  review: number;
  alreadyGone: number;
  failed: number;
  items: CleanupItemResult[];
} | { ok: false; message: string };

/** Child / leaf types before parents. active_commitment & event & floor_plan stay review-only. */
const DELETE_ORDER: MigrationEntityType[] = [
  "guest_list",
  "timeline_entry",
  "event_vendor_assignment",
  "document",
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
    // Venue relationship row is what import created for directory purposes.
    const { data } = await admin.from("venue_vendor_relationships")
      .select("updated_at, created_at")
      .eq("venue_id", venueId)
      .eq("vendor_id", entityId)
      .maybeSingle<{ updated_at: string; created_at: string }>();
    if (!data) return false; // gone
    return data.updated_at > baseline;
  }

  let q = admin.from(table).select("updated_at, created_at").eq("id", entityId);
  if (entityType !== "vendor") {
    // Most venue-scoped tables have venue_id
    q = q.eq("venue_id", venueId);
  }
  const { data } = await q.maybeSingle<{ updated_at: string; created_at: string }>();
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
    const label = labelFor(record);

    if (entityType === "active_commitment") {
      targets.push({
        recordId: record.id, entityType, entityId, label,
        disposition: "review",
        reason: "Active commitment / financial records are not auto-deleted. Review Event Order, invoice, and payment schedule manually.",
      });
      continue;
    }
    if (entityType === "event") {
      targets.push({
        recordId: record.id, entityType, entityId, label,
        disposition: "review",
        reason: "Standalone Events are not auto-deleted. Delete the Client (if eligible) to cascade, or remove the Event manually.",
      });
      continue;
    }
    if (entityType === "floor_plan") {
      targets.push({
        recordId: record.id, entityType, entityId, label,
        disposition: "review",
        reason: "Floor plans may be linked as Space templates — review and delete from Floor plans / Library.",
      });
      continue;
    }
    if (!DELETE_ORDER.includes(entityType)) {
      targets.push({
        recordId: record.id, entityType, entityId, label,
        disposition: "review",
        reason: `Automatic cleanup is not supported for "${entityType}" yet.`,
      });
      continue;
    }

    const exists = await entityExists(admin, venue.id, entityType, entityId);
    if (!exists) {
      targets.push({
        recordId: record.id, entityType, entityId, label,
        disposition: "already_gone",
        reason: "Record is already gone.",
      });
      continue;
    }

    const edited = await wasEditedSinceCommit(admin, venue.id, entityType, entityId, record.committedAt);
    if (edited) {
      targets.push({
        recordId: record.id, entityType, entityId, label,
        disposition: "review",
        reason: "Edited after import — refused automatic deletion.",
      });
      continue;
    }

    if (entityType === "client") {
      const preview = await previewDeleteClient(entityId);
      if (!preview.ok) {
        targets.push({
          recordId: record.id, entityType, entityId, label,
          disposition: "review",
          reason: preview.message,
        });
        continue;
      }
    }
    if (entityType === "lead") {
      const preview = await previewDeleteLead(entityId);
      if (!preview.ok) {
        targets.push({
          recordId: record.id, entityType, entityId, label,
          disposition: "review",
          reason: preview.message,
        });
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
          targets.push({
            recordId: record.id, entityType, entityId, label,
            disposition: "review",
            reason: guard.reason,
          });
          continue;
        }
      }
    }

    targets.push({
      recordId: record.id, entityType, entityId, label,
      disposition: "eligible",
      reason: "Attributed to this import and unchanged — safe to remove.",
    });
  }

  const eligibleCount = targets.filter((t) => t.disposition === "eligible").length;
  const reviewCount = targets.filter((t) => t.disposition === "review").length;
  const alreadyGoneCount = targets.filter((t) => t.disposition === "already_gone").length;

  if (reviewCount > 0) {
    warnings.push(
      `${reviewCount} record${reviewCount === 1 ? "" : "s"} need manual review and will not be deleted automatically.`,
    );
  }
  if (eligibleCount === 0 && reviewCount > 0) {
    warnings.push("Nothing is eligible for automatic cleanup. Use individual Delete on each reviewed record, or resolve financials first.");
  }
  warnings.push(
    "This is not a full session Undo — only records still attributed to this import and marked eligible are removed.",
  );

  return {
    ok: true,
    preview: {
      sessionId,
      venueId: venue.id,
      targets,
      eligibleCount,
      reviewCount,
      alreadyGoneCount,
      warnings,
    },
  };
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
    case "vendor": {
      const result = await deleteVendor_(entityId);
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    }
    case "package": {
      const result = await deletePackage_(entityId);
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    }
    case "calendar_block": {
      const result = await deleteBlock_(entityId);
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    }
    case "date_hold": {
      const result = await deleteHold_(entityId);
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    }
    case "tour": {
      const result = await deleteTourAppointment(entityId);
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    }
    case "timeline_entry": {
      const result = await deleteEntry(entityId);
      return result.ok ? { ok: true } : { ok: false, message: result.message };
    }
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
    case "document": {
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
 * Deletes only preview-eligible records, in dependency-safe order.
 * Re-runs eligibility checks at execute time (idempotent / refuse if state changed).
 */
export async function executeImportSessionCleanup(
  sessionId: string,
  opts: { confirmed: boolean },
): Promise<CleanupResult> {
  if (!opts.confirmed) {
    return { ok: false, message: "Confirmation required before cleanup." };
  }
  const previewed = await previewImportSessionCleanup(sessionId);
  if (!previewed.ok) return previewed;

  const { preview } = previewed;
  const items: CleanupItemResult[] = [];
  let deleted = 0;
  let review = 0;
  let alreadyGone = 0;
  let failed = 0;

  const ordered = [...preview.targets].sort((a, b) => {
    const ai = DELETE_ORDER.indexOf(a.entityType);
    const bi = DELETE_ORDER.indexOf(b.entityType);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  for (const target of ordered) {
    if (target.disposition === "already_gone") {
      alreadyGone++;
      items.push({
        recordId: target.recordId, entityType: target.entityType, entityId: target.entityId,
        outcome: "already_gone", message: target.reason,
      });
      continue;
    }
    if (target.disposition === "review") {
      review++;
      items.push({
        recordId: target.recordId, entityType: target.entityType, entityId: target.entityId,
        outcome: "review", message: target.reason,
      });
      continue;
    }

    // Re-check existence + edit + financial gates at execute time
    const admin = createAdminClient();
    const exists = await entityExists(admin, preview.venueId, target.entityType, target.entityId);
    if (!exists) {
      alreadyGone++;
      items.push({
        recordId: target.recordId, entityType: target.entityType, entityId: target.entityId,
        outcome: "already_gone", message: "Already removed before cleanup ran.",
      });
      continue;
    }
    const supabase = await createClient();
    const records = await repo.listRecords(supabase, sessionId, "committed");
    const record = records.find((r) => r.id === target.recordId);
    const edited = await wasEditedSinceCommit(
      admin, preview.venueId, target.entityType, target.entityId, record?.committedAt ?? null,
    );
    if (edited) {
      review++;
      items.push({
        recordId: target.recordId, entityType: target.entityType, entityId: target.entityId,
        outcome: "review", message: "Edited after preview — refused.",
      });
      continue;
    }

    const result = await deleteOne(preview.venueId, target.entityType, target.entityId);
    if (result.ok) {
      deleted++;
      items.push({
        recordId: target.recordId, entityType: target.entityType, entityId: target.entityId,
        outcome: "deleted", message: "Removed.",
      });
    } else {
      failed++;
      items.push({
        recordId: target.recordId, entityType: target.entityType, entityId: target.entityId,
        outcome: "failed", message: result.message,
      });
    }
  }

  return { ok: true, deleted, review, alreadyGone, failed, items };
}
