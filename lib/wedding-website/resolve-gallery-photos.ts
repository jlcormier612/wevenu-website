/**
 * Resolve the photo URLs that should appear in the Wedding Website gallery.
 * Prefer the couple's authored gallery; when empty, surface engagement /
 * cover uploads so Beautiful-by-Default does not invent a fixed 3-up of
 * one cover. Never truncates to a hard-coded count.
 */
export function resolveWebsiteGalleryPhotos(input: {
  galleryPhotos?: string[] | null;
  coverPhoto?: string | null;
  engagementPhotos?: string[] | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url?: string | null) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const url of input.galleryPhotos ?? []) push(url);
  if (out.length > 0) return out;

  // Authored gallery empty — fall back to the couple's uploaded set.
  push(input.coverPhoto);
  for (const url of input.engagementPhotos ?? []) push(url);
  return out;
}

/**
 * Seed an empty authored gallery from cover + engagement uploads.
 * When the couple already has gallery photos, returns that list unchanged —
 * never silently appends engagement/cover URLs (that caused Live Preview to
 * show 13+ images / visual duplicates while the Studio editor showed fewer).
 */
export function seedWebsiteGalleryPhotosIfEmpty(input: {
  galleryPhotos?: string[] | null;
  coverPhoto?: string | null;
  engagementPhotos?: string[] | null;
}): string[] {
  const authored = (input.galleryPhotos ?? []).map((u) => u.trim()).filter(Boolean);
  if (authored.length > 0) return [...authored];
  return resolveWebsiteGalleryPhotos({
    galleryPhotos: [],
    coverPhoto: input.coverPhoto,
    engagementPhotos: input.engagementPhotos,
  });
}

/**
 * Explicit opt-in union (e.g. Gallery editor "Import engagement photos").
 * Do not use for silent Studio/wizard persistence — that re-inflates the
 * gallery every visit. Use {@link seedWebsiteGalleryPhotosIfEmpty} instead.
 */
export function mergeWebsiteGalleryPhotos(input: {
  galleryPhotos?: string[] | null;
  coverPhoto?: string | null;
  engagementPhotos?: string[] | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (url?: string | null) => {
    const u = url?.trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };
  for (const url of input.galleryPhotos ?? []) push(url);
  push(input.coverPhoto);
  for (const url of input.engagementPhotos ?? []) push(url);
  return out;
}
