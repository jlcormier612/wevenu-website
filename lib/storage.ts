/**
 * lib/storage.ts — thin abstraction over file storage.
 *
 * Today: Supabase Storage (client-media bucket).
 * At launch: swap the three functions below for S3/R2 calls without touching
 * any route handler — the public interface stays identical.
 *
 * NEVER import this in client-accessible code. Server-only (Route Handlers,
 * Server Actions). Callers must have already validated the portal token.
 */

import { createAdminClient } from "@/integrations/supabase/admin";

const BUCKET = "client-media";

export async function uploadFile(
  path: string,
  file: File,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export function getPublicUrl(path: string): string {
  const admin = createAdminClient();
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeFile(path: string): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(BUCKET).remove([path]);
}

// Extension → (storage extension, fallback MIME type). Some browsers report
// an empty or unrecognized `file.type` for HEIC/HEIF specifically (common
// for photos straight off an iPhone) — falling back to the filename's own
// extension here means those uploads aren't rejected just because the
// browser didn't sniff a MIME type, and the stored file keeps a real
// matching extension instead of every non-explicit type being silently
// renamed to ".jpg" regardless of its actual bytes (found live, 2026-07-22,
// in both portal upload routes — this is the one shared place that logic
// lives now).
const KNOWN_IMAGE_EXTENSIONS: Record<string, { ext: string; mime: string }> = {
  ".png":  { ext: "png",  mime: "image/png" },
  ".jpg":  { ext: "jpg",  mime: "image/jpeg" },
  ".jpeg": { ext: "jpg",  mime: "image/jpeg" },
  ".gif":  { ext: "gif",  mime: "image/gif" },
  ".webp": { ext: "webp", mime: "image/webp" },
  ".heic": { ext: "heic", mime: "image/heic" },
  ".heif": { ext: "heif", mime: "image/heif" },
  ".avif": { ext: "avif", mime: "image/avif" },
  ".bmp":  { ext: "bmp",  mime: "image/bmp" },
  ".tif":  { ext: "tif",  mime: "image/tiff" },
  ".tiff": { ext: "tif",  mime: "image/tiff" },
};

export function resolveImageFile(file: File): { ext: string; mime: string } | null {
  if (file.type.startsWith("image/")) {
    const sub = file.type.split("/")[1]?.split(";")[0]?.toLowerCase();
    if (sub) return { ext: sub === "jpeg" ? "jpg" : sub, mime: file.type };
  }
  const match = file.name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? KNOWN_IMAGE_EXTENSIONS[match[0]] ?? null : null;
}
