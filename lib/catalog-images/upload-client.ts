/**
 * Browser upload helpers for Inventory / Offering photos in the public
 * `inventory` bucket. Path first segment must be the active venue id
 * (enforced by storage policies after migration). Writes go through the
 * authenticated server Storage route.
 */
import {
  CATALOG_IMAGE_BUCKET,
  extensionForCatalogMime,
} from "@/lib/catalog-images/types";
import { validateCatalogImageFile } from "@/lib/catalog-images/validate";
import { bustCache, removeFromStorage, uploadFileToStorage } from "@/lib/storage/upload";

export async function uploadCatalogImage(opts: {
  basePath: string;
  file: File;
}): Promise<string> {
  const validated = validateCatalogImageFile(opts.file);
  if (!validated.ok) throw new Error(validated.message);

  const ext = extensionForCatalogMime(validated.mime);
  const fullPath = `${opts.basePath}.${ext}`;

  // Clear prior extensions so replace does not leave orphan objects.
  await removeFromStorage(CATALOG_IMAGE_BUCKET, opts.basePath);

  const uploaded = await uploadFileToStorage({
    bucket: CATALOG_IMAGE_BUCKET,
    path: fullPath,
    file: opts.file,
    contentType: validated.mime,
    upsert: true,
  });
  return bustCache(uploaded.publicUrl);
}

export async function removeCatalogImage(basePath: string): Promise<void> {
  await removeFromStorage(CATALOG_IMAGE_BUCKET, basePath);
}
