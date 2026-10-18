/**
 * Venue data export. Server-only.
 * Authorization is canExportVenueData plus get_venue_export's own check.
 * The RPC is the data source so a granted exporter still receives business
 * rows that ordinary RLS would hide. Storage reads happen only for paths
 * the RPC returned that also contain this venue id as a path segment.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { canExportVenueData } from "@/lib/authorization/export-access";
import { getActiveVenueMembership } from "@/lib/authorization/membership";
import { isSupabaseConfigured } from "@/lib/env";
import {
  buildVenueExportZip,
  collectExportFiles,
  type ExportFileBucket,
  type ExportFileRef,
  venueOwnsStoragePath,
} from "@/lib/export/archive";
import { getCurrentVenue } from "@/lib/venue/service";

const MAX_FILES = 400;
const MAX_BYTES = 60 * 1024 * 1024;
const REPRESENTATION_BUCKETS = [
  "contract-representations",
  "event-order-representations",
  "documents",
] as const satisfies readonly ExportFileBucket[];

export type ExportArchiveResult =
  | { ok: true; bytes: Uint8Array; filename: string }
  | { ok: false; status: 401 | 403 | 404 | 413 | 500 | 503; message: string };

async function downloadOwned(
  file: ExportFileRef,
  venueId: string,
): Promise<{ bucket: ExportFileBucket; bytes: Uint8Array }> {
  if (!venueOwnsStoragePath(venueId, file.path)) {
    throw new Error("Refusing a storage path that is not owned by this venue.");
  }
  const admin = createAdminClient();
  const buckets = file.bucket ? [file.bucket] : REPRESENTATION_BUCKETS;
  let reason = "not found";
  for (const bucket of buckets) {
    const { data, error } = await admin.storage.from(bucket).download(file.path);
    if (!error && data) {
      return { bucket, bytes: new Uint8Array(await data.arrayBuffer()) };
    }
    if (error?.message) reason = error.message;
  }
  throw new Error(`Could not read venue file from ${buckets.join(", ")} (${reason}).`);
}

export async function buildVenueExportArchive(): Promise<ExportArchiveResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, status: 503, message: "Backend not configured." };
  }
  const membership = await getActiveVenueMembership();
  if (!membership) return { ok: false, status: 401, message: "You need to be signed in." };
  if (!canExportVenueData(membership)) {
    return { ok: false, status: 403, message: "You do not have permission to export venue data." };
  }
  const venue = await getCurrentVenue();
  if (!venue || venue.id !== membership.venueId) {
    return { ok: false, status: 404, message: "No venue found." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_venue_export", { p_venue_id: venue.id });
  if (error) {
    console.error("[venue-export] rpc failed", error.message);
    return { ok: false, status: 500, message: "Could not export your data." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, status: 500, message: "Could not export your data." };
  }
  const payload = data as Record<string, unknown>;
  if (payload.error === "not_authorized") {
    return { ok: false, status: 403, message: "You do not have permission to export venue data." };
  }

  const collections = { ...payload };
  delete collections.error;
  delete collections.exportedAt;
  const exportedAt = typeof payload.exportedAt === "string" ? payload.exportedAt : new Date().toISOString();
  delete collections.exportedAt;

  const files = collectExportFiles(collections, venue.id);
  if (files.length > MAX_FILES) {
    return { ok: false, status: 413, message: "This export has too many files to download in one archive." };
  }

  const fileBytes: Array<{ file: ExportFileRef; bytes: Uint8Array }> = [];
  let total = 0;
  try {
    for (const file of files) {
      const downloaded = await downloadOwned(file, venue.id);
      total += downloaded.bytes.byteLength;
      if (total > MAX_BYTES) {
        return { ok: false, status: 413, message: "This export is too large to download in one archive." };
      }
      fileBytes.push({
        file: { ...file, bucket: downloaded.bucket },
        bytes: downloaded.bytes,
      });
    }
  } catch (err) {
    console.error("[venue-export] file read failed", err instanceof Error ? err.message : err);
    return { ok: false, status: 500, message: "A venue file could not be read. The export was not completed." };
  }

  const bytes = buildVenueExportZip({
    venueId: venue.id,
    exportedAt,
    collections,
    fileBytes,
  });
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, status: 413, message: "This export is too large to download in one archive." };
  }
  const date = exportedAt.slice(0, 10);
  return { ok: true, bytes, filename: `hello-to-cheers-venue-export-${date}.zip` };
}
