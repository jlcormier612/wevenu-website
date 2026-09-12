import { createAdminClient } from "@/integrations/supabase/admin";
import { DOCUMENTS_BUCKET, isDocumentsPublicUrl, storagePathFromDocumentsUrl } from "@/lib/documents/access";

const SIGNED_TTL_SECONDS = 300;

export async function createDocumentsSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(storagePath, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Rewrite a stored documents-bucket public URL to a short-lived signed URL. Other URLs pass through. */
export async function signDocumentsUrlIfNeeded(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (!isDocumentsPublicUrl(url)) return url;
  const path = storagePathFromDocumentsUrl(url);
  if (!path) return url;
  return (await createDocumentsSignedUrl(path)) ?? url;
}
