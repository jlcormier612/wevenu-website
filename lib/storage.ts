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
