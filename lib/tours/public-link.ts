/**
 * Canonical public tour scheduler. The venue website, QR codes, and Calendar
 * all share /book/{tour_embed_key}. The page is app/book/[key]/page.tsx.
 * Availability changes do not change this path.
 */
export function publicTourSchedulingPath(tourEmbedKey: string | null | undefined): string | null {
  const key = tourEmbedKey?.trim();
  if (!key) return null;
  return `/book/${encodeURIComponent(key)}`;
}
