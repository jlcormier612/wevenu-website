import { createAdminClient } from "@/integrations/supabase/admin";
import {
  CLIENT_MEDIA_BUCKET,
  DOCUMENTS_BUCKET,
  isClientMediaPublicUrl,
  isDocumentsPublicUrl,
  storagePathFromClientMediaUrl,
  storagePathFromDocumentsUrl,
} from "@/lib/documents/access";

const SIGNED_TTL_SECONDS = 300;

export async function createDocumentsSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUrl(storagePath, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function createClientMediaSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(CLIENT_MEDIA_BUCKET)
    .createSignedUrl(storagePath, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Resolve a download/preview URL for an authorized documents row.
 * Tries the private documents bucket first; falls back to client-media when
 * the row references a couple upload (same object, no second copy).
 */
export async function resolveAuthorizedDocumentFileUrl(input: {
  storagePath: string;
  storageUrl?: string | null;
}): Promise<string | null> {
  if (!input.storagePath && !input.storageUrl) return null;

  if (input.storagePath) {
    const fromDocuments = await createDocumentsSignedUrl(input.storagePath);
    if (fromDocuments) return fromDocuments;
  }

  const mediaPath =
    (input.storageUrl ? storagePathFromClientMediaUrl(input.storageUrl) : null)
    ?? input.storagePath;

  if (mediaPath) {
    const fromMedia = await createClientMediaSignedUrl(mediaPath);
    if (fromMedia) return fromMedia;
  }

  // Public client-media URLs are already world-readable; only return after
  // the caller has authorized the document row.
  if (input.storageUrl && isClientMediaPublicUrl(input.storageUrl)) {
    return input.storageUrl;
  }

  return null;
}

/** Rewrite a stored documents-bucket public URL to a short-lived signed URL. Other URLs pass through. */
export async function signDocumentsUrlIfNeeded(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (!isDocumentsPublicUrl(url)) return url;
  const path = storagePathFromDocumentsUrl(url);
  if (!path) return url;
  return (await createDocumentsSignedUrl(path)) ?? url;
}
