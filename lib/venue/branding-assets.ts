/**
 * Live venue branding asset URLs.
 *
 * Source of truth is always `venues.logo_url` / `venues.hero_image_url`.
 * Storage upserts keep the same public object path, so browsers/CDNs can
 * keep serving a prior byteset unless the URL the app hands to <img> changes.
 *
 * Every experience (venue app, couple portal, vendor portal) should run logo
 * and hero URLs through {@link versionedVenueAssetUrl} with `venues.updated_at`
 * (bumped on every venues UPDATE) so a branding change invalidates caches
 * everywhere without per-portal snapshots or duplicated fields.
 */

/** Strip prior cache-buster query keys we own (`t`, `v`) and apply a fresh `v=`. */
export function versionedVenueAssetUrl(
  url: string | null | undefined,
  version: string | number | Date | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  let versionKey: string;
  if (version instanceof Date) {
    versionKey = String(version.getTime());
  } else if (typeof version === "number" && Number.isFinite(version)) {
    versionKey = String(Math.trunc(version));
  } else if (typeof version === "string" && version.trim()) {
    const asDate = Date.parse(version);
    versionKey = Number.isFinite(asDate) ? String(asDate) : version.trim();
  } else {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("t");
    parsed.searchParams.delete("v");
    parsed.searchParams.set("v", versionKey);
    return parsed.toString();
  } catch {
    const base = raw.split("?")[0] ?? raw;
    return `${base}?v=${encodeURIComponent(versionKey)}`;
  }
}

export function applyLiveVenueBrandingUrls<
  T extends { logoUrl?: string | null; heroImageUrl?: string | null },
>(branding: T, updatedAt: string | number | Date | null | undefined): T {
  return {
    ...branding,
    logoUrl: versionedVenueAssetUrl(branding.logoUrl, updatedAt),
    heroImageUrl: versionedVenueAssetUrl(branding.heroImageUrl, updatedAt),
  };
}
