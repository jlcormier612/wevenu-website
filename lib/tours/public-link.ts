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

/** Lead-scoped public scheduler. `originToken` is the opaque HMAC query `o`. */
export function publicTourSchedulingPathForLead(
  tourEmbedKey: string | null | undefined,
  originToken: string | null | undefined,
): string | null {
  const base = publicTourSchedulingPath(tourEmbedKey);
  const token = originToken?.trim();
  if (!base || !token) return null;
  return `${base}?o=${encodeURIComponent(token)}`;
}
