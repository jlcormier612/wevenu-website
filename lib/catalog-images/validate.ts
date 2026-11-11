import {
  CATALOG_IMAGE_MAX_BYTES,
  isAllowedCatalogImageMime,
} from "@/lib/catalog-images/types";

export type CatalogImageValidation =
  | { ok: true; mime: string }
  | { ok: false; message: string };

/** Server-side / client-side shared validation. MIME must be an allowed image type. */
export function validateCatalogImageFile(file: {
  type: string;
  size: number;
}): CatalogImageValidation {
  if (!isAllowedCatalogImageMime(file.type)) {
    return {
      ok: false,
      message: "Use a JPEG, PNG, WebP, or GIF photo (max 5 MB).",
    };
  }
  if (file.size <= 0 || file.size > CATALOG_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: "Photo must be 5 MB or smaller.",
    };
  }
  return { ok: true, mime: file.type.toLowerCase() };
}
