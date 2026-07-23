/**
 * Migration Center (Hospitality Success Platform §2.1) — batch tracking.
 * One row per import run (supabase/migrations/20261139000000_migration_
 * center_foundation.sql's import_batches table) — what unlocks a real
 * import history and conservative, window-limited rollback, neither of
 * which existed before this (the import wizard previously had no concept
 * of "everything imported together" at all).
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import type { EntityType, ImportBatch } from "@/lib/import/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

const REAL_TABLE: Record<EntityType, string> = {
  couples: "clients",
  leads: "leads",
  vendors: "vendors",
  inventory: "inventory_items",
  packages: "packages",
};

function mapBatch(r: Record<string, unknown>): ImportBatch {
  return {
    id: r.id as string,
    venueId: r.venue_id as string,
    entityType: r.entity_type as EntityType,
    sourceLabel: (r.source_label ?? null) as string | null,
    importedByType: r.imported_by_type as ImportBatch["importedByType"],
    importedBy: (r.imported_by ?? null) as string | null,
    rowCount: r.row_count as number,
    importedCount: r.imported_count as number,
    skippedCount: r.skipped_count as number,
    errorCount: r.error_count as number,
    rolledBackAt: (r.rolled_back_at ?? null) as string | null,
    createdAt: r.created_at as string,
  };
}

/** Creates the batch row for a self-service (venue-session) import. Never throws — a failed batch record must never block the import itself. */
export async function createImportBatch(
  venueId: string,
  entityType: EntityType,
  sourceLabel: string | null,
  rowCount: number,
  client?: DbClient,
): Promise<string | null> {
  try {
    const supabase = client ?? await createClient();
    const { data, error } = await supabase.from("import_batches")
      .insert({ venue_id: venueId, entity_type: entityType, source_label: sourceLabel, row_count: rowCount, imported_by_type: "venue" })
      .select("id").single<{ id: string }>();
    if (error) throw error;
    return data.id;
  } catch (err) {
    console.error("Could not create import batch:", err);
    return null;
  }
}

/**
 * White-Glove Migration (Hospitality Success Platform §2.2a step 4) — the
 * batch row for a staff-run import "on behalf of" a venue. `imported_by`
 * is the HQ admin's own identity (never the venue's), and `engagementId`
 * links the batch to the venue's onboarding case file when one exists —
 * so "what did this engagement actually import" is a direct query, not a
 * timestamp-window guess (per the plan's own §2.2a rationale). `client`
 * must be a service_role admin client — this never resolves a session
 * venue itself, unlike createImportBatch above.
 */
export async function createImportBatchForVenue(
  client: DbClient,
  venueId: string,
  entityType: EntityType,
  sourceLabel: string | null,
  rowCount: number,
  importedByAdminId: string,
  engagementId: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await client.from("import_batches")
      .insert({
        venue_id: venueId, entity_type: entityType, source_label: sourceLabel, row_count: rowCount,
        imported_by_type: "hq_staff", imported_by: importedByAdminId, engagement_id: engagementId,
      })
      .select("id").single<{ id: string }>();
    if (error) throw error;
    return data.id;
  } catch (err) {
    console.error("Could not create import batch:", err);
    return null;
  }
}

/** Finalizes a batch's counts once the import loop completes. Best-effort. */
export async function finalizeImportBatch(
  batchId: string | null,
  counts: { imported: number; skipped: number; errors: number },
  client?: DbClient,
): Promise<void> {
  if (!batchId) return;
  try {
    const supabase = client ?? await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("import_batches") as any)
      .update({ imported_count: counts.imported, skipped_count: counts.skipped, error_count: counts.errors })
      .eq("id", batchId);
  } catch (err) {
    console.error("Could not finalize import batch:", err);
  }
}

/**
 * Stamps import_batch_id on every row this run actually created. A separate
 * follow-up write (not threaded through each entity's own create path) so
 * it works uniformly whether that path is a plain insert or an atomic RPC.
 *
 * Also records `stamped_at` — the moment this stamp itself lands, per this
 * table's own updated_at trigger — as the batch's rollback baseline.
 * Found live during verification: this UPDATE is itself what changes a
 * fresh row's updated_at away from its created_at, so "untouched since
 * import" can never be `updated_at === created_at`; it has to be
 * `updated_at <= stamped_at` instead.
 */
export async function stampImportBatch(
  entityType: EntityType,
  batchId: string | null,
  ids: string[],
  client?: DbClient,
): Promise<void> {
  if (!batchId || ids.length === 0) return;
  try {
    const supabase = client ?? await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from(REAL_TABLE[entityType]) as any)
      .update({ import_batch_id: batchId })
      .in("id", ids)
      .select("updated_at");
    const stampedAt = ((data ?? []) as { updated_at: string }[])
      .reduce((latest, r) => (r.updated_at > latest ? r.updated_at : latest), new Date(0).toISOString());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("import_batches") as any).update({ stamped_at: stampedAt }).eq("id", batchId);
  } catch (err) {
    console.error("Could not stamp import batch on created rows:", err);
  }
}

export async function getImportBatches(entityType?: EntityType): Promise<ImportBatch[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  let q = supabase.from("import_batches").select("*").eq("venue_id", venue.id);
  if (entityType) q = q.eq("entity_type", entityType);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(20);
  if (error) return [];
  return (data as Record<string, unknown>[]).map(mapBatch);
}

export type RollbackResult = { ok: true; deletedCount: number } | { ok: false; message: string };

/**
 * Conservative, window-limited rollback (decided 2026-07-22): a batch can
 * only be undone while nothing downstream has touched the rows it created.
 * The heuristic: every row's updated_at must still equal its created_at —
 * the moment anything (a coordinator editing it, a payment recorded
 * against it, a message sent to it) touches the row, its updated_at moves
 * and rollback is refused rather than silently discarding real activity.
 * Matches this codebase's existing "confirm before, don't undo after"
 * philosophy — this is the one deliberate exception, scoped as narrowly as
 * the plan requires.
 */
export async function rollbackImportBatch(batchId: string): Promise<RollbackResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "Session expired." };
  const supabase = await createClient();

  const { data: batch } = await supabase.from("import_batches").select("*")
    .eq("id", batchId).eq("venue_id", venue.id).maybeSingle<Record<string, unknown>>();
  if (!batch) return { ok: false, message: "Import not found." };
  if (batch.rolled_back_at) return { ok: false, message: "This import has already been undone." };

  const entityType = batch.entity_type as EntityType;
  const table = REAL_TABLE[entityType];

  // Baseline is stamped_at (when the import itself last wrote to these
  // rows), not created_at — stamping import_batch_id is itself an UPDATE,
  // so created_at and updated_at differ from the moment of import
  // regardless of any later real edit. A small buffer absorbs any
  // clock/replication skew between the stamp write and this read.
  const stampedAt = batch.stamped_at as string | null;
  const baseline = stampedAt ? new Date(new Date(stampedAt).getTime() + 2000).toISOString() : null;

  const { data: rows, error } = await supabase.from(table)
    .select("id, updated_at").eq("import_batch_id", batchId);
  if (error) return { ok: false, message: "Could not check this import's rows." };
  const allRows = (rows ?? []) as { id: string; updated_at: string }[];
  const touched = baseline ? allRows.filter((r) => r.updated_at > baseline) : [];
  if (touched.length > 0) {
    return {
      ok: false,
      message: `${touched.length} of the ${allRows.length} imported record${allRows.length === 1 ? "" : "s"} ${touched.length === 1 ? "has" : "have"} already been used elsewhere, so this import can no longer be automatically undone.`,
    };
  }
  if (allRows.length === 0) return { ok: false, message: "Nothing to undo — no records remain from this import." };

  const ids = allRows.map((r) => r.id);

  // Vendors: `vendors` is a global, potentially cross-venue profile table
  // (confirmed live, not assumed — it has no venue_id of its own). Rollback
  // removes this venue's directory relationship, not the shared profile
  // itself — deleting a global profile a rollback didn't create the full
  // lifecycle of is out of scope for a conservative undo.
  if (entityType === "vendors") {
    const { error: relError } = await supabase.from("venue_vendor_relationships")
      .delete().eq("venue_id", venue.id).in("vendor_id", ids);
    if (relError) return { ok: false, message: "Could not undo this import." };
  } else {
    const { error: deleteError } = await supabase.from(table).delete().in("id", ids);
    if (deleteError) return { ok: false, message: "Could not undo this import." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("import_batches") as any).update({ rolled_back_at: new Date().toISOString() }).eq("id", batchId);

  return { ok: true, deletedCount: ids.length };
}
