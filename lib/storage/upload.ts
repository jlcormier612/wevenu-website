/**
 * Shared file-upload infrastructure (Sprint 19).
 *
 * Uses the Supabase JS browser client (createBrowserClient) so these
 * functions run in Client Components. The `uploads` bucket is public;
 * RLS policies restrict writes to authenticated users.
 *
 * Bucket structure:
 *   uploads/{venue_id}/logo.{ext}           — venue logo
 *   uploads/{venue_id}/leads/{id}/*         — lead photos  (future)
 *   uploads/{venue_id}/clients/{id}/*       — couple photos (future)
 *
 * The `floor-plans` bucket (Sprint 18) is intentionally separate and
 * retains its own upload logic in FloorPlanEditor.
 */

import { createClient } from "@/integrations/supabase/client";

/** Upload a file and return its public URL. The path should NOT include the extension. */
export async function uploadToStorage(
  bucket: string,
  basePath: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const fullPath = `${basePath}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  return data.publicUrl;
}

/** Remove a file from storage. Tries common image extensions. */
export async function removeFromStorage(
  bucket: string,
  basePath: string,
): Promise<void> {
  const supabase = createClient();
  const paths = ["jpg", "jpeg", "png", "svg", "gif", "webp", "avif"].map(
    (ext) => `${basePath}.${ext}`,
  );
  await supabase.storage.from(bucket).remove(paths);
}

/** Re-add a cache-busting timestamp to a URL so browsers re-fetch after an update. */
export function bustCache(url: string): string {
  const base = url.split("?")[0];
  return `${base}?t=${Date.now()}`;
}
