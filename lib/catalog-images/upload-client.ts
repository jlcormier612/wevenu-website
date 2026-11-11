/**
 * Browser upload helpers for Inventory / Offering photos in the public
 * `inventory` bucket. Path first segment must be the active venue id
 * (enforced by storage policies after migration).
 */
import { createClient } from "@/integrations/supabase/client";
import {
  CATALOG_IMAGE_BUCKET,
  extensionForCatalogMime,
} from "@/lib/catalog-images/types";
import { validateCatalogImageFile } from "@/lib/catalog-images/validate";
import { bustCache, removeFromStorage } from "@/lib/storage/upload";

export async function uploadCatalogImage(opts: {
  basePath: string;
  file: File;
}): Promise<string> {
  const validated = validateCatalogImageFile(opts.file);
  if (!validated.ok) throw new Error(validated.message);

  const ext = extensionForCatalogMime(validated.mime);
  const fullPath = `${opts.basePath}.${ext}`;
  const supabase = createClient();

  // Clear prior extensions so replace does not leave orphan objects.
  await removeFromStorage(CATALOG_IMAGE_BUCKET, opts.basePath);

  const { error } = await supabase.storage.from(CATALOG_IMAGE_BUCKET).upload(fullPath, opts.file, {
    upsert: true,
    contentType: validated.mime,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(CATALOG_IMAGE_BUCKET).getPublicUrl(fullPath);
  return bustCache(data.publicUrl);
}

export async function removeCatalogImage(basePath: string): Promise<void> {
  await removeFromStorage(CATALOG_IMAGE_BUCKET, basePath);
}
