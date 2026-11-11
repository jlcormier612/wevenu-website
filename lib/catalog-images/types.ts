/** Shared catalog photo constraints (Inventory items + Offerings). */

export const CATALOG_IMAGE_BUCKET = "inventory" as const;

/** 5 MiB — matches storage.buckets.file_size_limit in migration. */
export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const CATALOG_IMAGE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type CatalogImageMime = (typeof CATALOG_IMAGE_ALLOWED_MIME)[number];

export function isAllowedCatalogImageMime(value: string | null | undefined): value is CatalogImageMime {
  if (!value) return false;
  return (CATALOG_IMAGE_ALLOWED_MIME as readonly string[]).includes(value.toLowerCase());
}

export function extensionForCatalogMime(mime: string): string {
  switch (mime.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

/** Inventory item photo object base path (no extension). */
export function inventoryItemImageBasePath(venueId: string, itemId: string): string {
  return `${venueId}/${itemId}/image`;
}

/** Offering photo object base path (no extension). */
export function offeringImageBasePath(venueId: string, offeringId: string): string {
  return `${venueId}/offerings/${offeringId}/image`;
}

/**
 * Effective display URL for an Offering: dedicated photo first, then linked
 * Inventory item photo. Neither present → null (no UI chrome).
 */
export function effectiveOfferingImageUrl(input: {
  imageUrl?: string | null;
  inventoryImageUrl?: string | null;
}): string | null {
  const own = input.imageUrl?.trim();
  if (own) return own;
  const inv = input.inventoryImageUrl?.trim();
  return inv || null;
}

/**
 * Reject DB image_url values that point outside this venue's inventory-bucket
 * folder. Public reads remain allowed; this blocks cross-venue row hijacking.
 */
export function catalogImageUrlBelongsToVenue(
  imageUrl: string | null | undefined,
  venueId: string,
): boolean {
  if (imageUrl == null || imageUrl.trim() === "") return true;
  const trimmed = imageUrl.trim();
  if (!venueId) return false;
  // Public object URLs contain `/object/public/inventory/{venueId}/…`
  // or `/object/sign/inventory/{venueId}/…`. Also accept path-only forms.
  const marker = `/${CATALOG_IMAGE_BUCKET}/${venueId}/`;
  if (trimmed.includes(marker)) return true;
  if (trimmed.startsWith(`${venueId}/`)) return true;
  try {
    const path = new URL(trimmed).pathname;
    return path.includes(marker) || path.startsWith(`/${venueId}/`);
  } catch {
    return false;
  }
}
