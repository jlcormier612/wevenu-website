/**
 * Shared file-upload infrastructure (Sprint 19).
 *
 * Browser helpers call the authenticated server Storage routes so HttpOnly
 * session cookies still authorize Storage RLS. Do not call
 * createBrowserClient().storage.upload from Client Components for staff
 * venue/vendor assets.
 *
 * Bucket structure:
 *   uploads/{venue_id}/logo.{ext}           — venue logo
 *   uploads/{venue_id}/leads/{id}/*         — lead photos  (future)
 *   uploads/{venue_id}/clients/{id}/*       — couple photos (future)
 *
 * The `floor-plans` bucket (Sprint 18) is intentionally separate and
 * retains its own upload logic in FloorPlanEditor (now also server-mediated).
 */

import {
  CUSTOMER_UPLOAD_FAILED_MESSAGE,
  customerFacingUploadError,
} from "@/lib/storage/customer-upload-errors";

export type StaffUploadScope = "venue" | "vendor";

type UploadApiOk = { ok: true; path: string; publicUrl: string };
type UploadApiErr = { ok: false; error?: string };
type RemoveApiOk = { ok: true };
type RemoveApiErr = { ok: false; error?: string };

/** Upload a file and return its public URL. The path should NOT include the extension. */
export async function uploadToStorage(
  bucket: string,
  basePath: string,
  file: File,
  opts?: { scope?: StaffUploadScope; upsert?: boolean; maxBytes?: number },
): Promise<string> {
  const form = new FormData();
  form.set("file", file);
  form.set("bucket", bucket);
  form.set("basePath", basePath);
  form.set("upsert", opts?.upsert === false ? "false" : "true");
  form.set("scope", opts?.scope ?? "venue");
  if (opts?.maxBytes) form.set("maxBytes", String(opts.maxBytes));

  const res = await fetch("/api/venue/storage/upload", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => null)) as UploadApiOk | UploadApiErr | null;
  if (!res.ok || !json || !("ok" in json) || !json.ok) {
    const raw = json && "error" in json ? json.error : null;
    throw new Error(customerFacingUploadError(raw) || CUSTOMER_UPLOAD_FAILED_MESSAGE);
  }
  return bustCache(json.publicUrl);
}

/**
 * Upload using a full object path (including extension). Used by documents,
 * floor plans, playbooks, and other callers that mint their own UUID paths.
 */
export async function uploadFileToStorage(opts: {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  upsert?: boolean;
  scope?: StaffUploadScope;
  maxBytes?: number;
  /** Optional File name when `file` is a Blob. */
  fileName?: string;
}): Promise<{ path: string; publicUrl: string }> {
  const form = new FormData();
  const asFile =
    opts.file instanceof File
      ? opts.file
      : new File([opts.file], opts.fileName ?? "upload.bin", {
          type: opts.contentType || "application/octet-stream",
        });
  form.set("file", asFile);
  form.set("bucket", opts.bucket);
  form.set("path", opts.path);
  form.set("upsert", opts.upsert ? "true" : "false");
  form.set("scope", opts.scope ?? "venue");
  if (opts.maxBytes) form.set("maxBytes", String(opts.maxBytes));

  const res = await fetch("/api/venue/storage/upload", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => null)) as UploadApiOk | UploadApiErr | null;
  if (!res.ok || !json || !("ok" in json) || !json.ok) {
    const raw = json && "error" in json ? json.error : null;
    throw new Error(customerFacingUploadError(raw) || CUSTOMER_UPLOAD_FAILED_MESSAGE);
  }
  return { path: json.path, publicUrl: bustCache(json.publicUrl) };
}

/** Remove a file from storage. Tries common image extensions when basePath has no extension. */
export async function removeFromStorage(
  bucket: string,
  basePath: string,
  opts?: { scope?: StaffUploadScope; exactPath?: boolean },
): Promise<void> {
  const paths = opts?.exactPath
    ? [basePath]
    : ["jpg", "jpeg", "png", "svg", "gif", "webp", "avif"].map((ext) => `${basePath}.${ext}`);
  await removeStoragePaths(bucket, paths, opts?.scope ?? "venue");
}

export async function removeStoragePaths(
  bucket: string,
  paths: string[],
  scope: StaffUploadScope = "venue",
): Promise<void> {
  const res = await fetch("/api/venue/storage/remove", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ bucket, paths, scope }),
  });
  const json = (await res.json().catch(() => null)) as RemoveApiOk | RemoveApiErr | null;
  if (!res.ok || !json || !("ok" in json) || !json.ok) {
    const raw = json && "error" in json ? json.error : null;
    throw new Error(customerFacingUploadError(raw) || CUSTOMER_UPLOAD_FAILED_MESSAGE);
  }
}

/** Re-add a cache-busting timestamp to a URL so browsers re-fetch after an update. */
export function bustCache(url: string): string {
  const base = url.split("?")[0];
  return `${base}?t=${Date.now()}`;
}

const IMAGE_NAME = /\.(jpe?g|png|gif|webp|avif|svg)$/i;

/**
 * Public URLs for existing objects under a prefix in the uploads bucket.
 * Listing still uses the browser client for public-read buckets; write paths
 * must use the server-mediated helpers above.
 */
export async function listPublicUploadUrls(prefix: string): Promise<string[]> {
  // Dynamic import keeps this module usable from tests that only exercise
  // upload helpers without pulling the browser Supabase singleton.
  const { createClient } = await import("@/integrations/supabase/client");
  const supabase = createClient();
  const folder = prefix.replace(/\/+$/, "");
  const { data, error } = await supabase.storage.from("uploads").list(folder, {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data) return [];
  const urls: string[] = [];
  for (const item of data) {
    if (!item.name || item.name.startsWith(".") || item.name.endsWith("/") || item.id == null) continue;
    if (!IMAGE_NAME.test(item.name)) continue;
    const { data: pub } = supabase.storage.from("uploads").getPublicUrl(`${folder}/${item.name}`);
    if (pub.publicUrl) urls.push(pub.publicUrl);
  }
  return urls;
}
