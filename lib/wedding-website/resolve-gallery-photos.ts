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

/** Merge engagement / cover URLs into an authored gallery without dropping existing entries. */
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
