import { strToU8, zipSync } from "fflate";

/** Keys removed everywhere in the archive. Mirrors venue_export_redact in SQL. */
export const EXPORT_REDACT_KEYS = [
  "stripe_account_id",
  "embed_key",
  "tour_embed_key",
  "sign_token",
  "access_token",
  "refresh_token",
  "user_access_token",
  "page_access_token",
  "client_secret",
  "api_key",
  "webhook_secret",
  "password",
  "password_hash",
  "secret_key",
  "token",
  "luv_draft_id",
] as const;

const REDACT = new Set<string>(EXPORT_REDACT_KEYS);

export const EXPORT_FILE_BUCKETS = [
  "documents",
  "contract-representations",
  "event-order-representations",
  "floor-plans",
  "uploads",
] as const;

export type ExportFileBucket = (typeof EXPORT_FILE_BUCKETS)[number];

export type ExportFileRef = {
  /** Null means the object lives in one of the representation buckets. */
  bucket: ExportFileBucket | null;
  path: string;
  fileName: string;
};

const OMITTED = [
  { name: "Wedding websites", reason: "Couple-owned website content is not part of the venue export." },
  { name: "Couple planning data", reason: "Guest lists, seating, budgets, RSVP answers, and questionnaire answers stay with the couple export." },
  { name: "Luv", reason: "Luv recommendations, drafts, and internal signals are excluded." },
  { name: "Credentials", reason: "Passwords, tokens, embed keys, and payment-account secrets are excluded." },
  { name: "Platform operations", reason: "Hello to Cheers CRM, HQ, and incident records are excluded." },
];

export function redactExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactExportValue(item));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT.has(key)) continue;
    out[key] = redactExportValue(child);
  }
  return out;
}

export function venueOwnsStoragePath(venueId: string, storagePath: string): boolean {
  if (!venueId || !storagePath) return false;
  const parts = storagePath.split("/").filter(Boolean);
  return parts.includes(venueId);
}

export function storagePathFromUrl(url: string, bucket: string): string | null {
  for (const marker of [`/object/public/${bucket}/`, `/object/sign/${bucket}/`, `/object/${bucket}/`]) {
    const index = url.indexOf(marker);
    if (index >= 0) {
      const rest = url.slice(index + marker.length).split("?")[0] ?? "";
      try {
        return decodeURIComponent(rest) || null;
      } catch {
        return rest || null;
      }
    }
  }
  return null;
}

function pushFile(
  files: ExportFileRef[],
  seen: Set<string>,
  venueId: string,
  bucket: ExportFileBucket | null,
  storagePath: string | null | undefined,
  fileName: string,
) {
  if (!storagePath || !venueOwnsStoragePath(venueId, storagePath)) return;
  const key = `${bucket ?? "resolve"}/${storagePath}`;
  if (seen.has(key)) return;
  seen.add(key);
  files.push({ bucket, path: storagePath, fileName: fileName || storagePath.split("/").at(-1) || "file" });
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") as Record<string, unknown>[] : [];
}

export function collectExportFiles(collections: Record<string, unknown>, venueId: string): ExportFileRef[] {
  const files: ExportFileRef[] = [];
  const seen = new Set<string>();
  for (const row of rows(collections.documents)) {
    pushFile(files, seen, venueId, "documents", stringField(row.storage_path), stringField(row.file_name) || "document");
  }
  for (const row of rows(collections.document_file_versions)) {
    pushFile(files, seen, venueId, "documents", stringField(row.storage_path), stringField(row.file_name) || "document-version");
  }
  for (const row of rows(collections.message_attachments)) {
    pushFile(files, seen, venueId, "documents", stringField(row.storage_path), stringField(row.name) || "attachment");
  }
  for (const row of rows(collections.floor_plans)) {
    const url = stringField(row.background_image_url);
    if (!url) continue;
    const path = storagePathFromUrl(url, "floor-plans") ?? (venueOwnsStoragePath(venueId, url) ? url : null);
    pushFile(files, seen, venueId, "floor-plans", path, "floor-plan-background");
  }
  for (const row of rows(collections.canonical_document_representations)) {
    pushFile(
      files,
      seen,
      venueId,
      null,
      stringField(row.storage_path),
      stringField(row.representation_type) || "representation",
    );
  }
  return files;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildVenueExportZip(input: {
  venueId: string;
  exportedAt: string;
  collections: Record<string, unknown>;
  fileBytes?: Array<{ file: ExportFileRef; bytes: Uint8Array }>;
}): Uint8Array {
  const collections = redactExportValue(input.collections) as Record<string, unknown>;
  const counts: Record<string, number> = {};
  const entries: Record<string, Uint8Array> = {};
  for (const [name, value] of Object.entries(collections)) {
    counts[name] = Array.isArray(value) ? value.length : value ? 1 : 0;
    entries[`data/${name}.json`] = strToU8(`${JSON.stringify(value, null, 2)}\n`);
  }
  const included = input.fileBytes ?? [];
  for (const file of included) {
    if (!venueOwnsStoragePath(input.venueId, file.file.path)) continue;
    const bucket = file.file.bucket ?? "representations";
    entries[`files/${bucket}/${file.file.path}`] = file.bytes;
  }
  const manifest = {
    exportedAt: input.exportedAt,
    venueId: input.venueId,
    counts,
    files: included
      .filter((file) => venueOwnsStoragePath(input.venueId, file.file.path))
      .map((file) => ({
        bucket: file.file.bucket,
        path: file.file.path,
        fileName: file.file.fileName,
      })),
    omitted: OMITTED,
  };
  entries["manifest.json"] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
  return zipSync(entries);
}
