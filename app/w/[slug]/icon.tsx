import { venueFaviconResponse, faviconSize, faviconContentType } from "@/lib/venue-brand/favicon";

export const size = faviconSize;
export const contentType = faviconContentType;

/**
 * Venue Brand Experience Phase 1 — stops this customer-facing route from
 * inheriting the app's own Hello to Cheers favicon. Uses the neutral fallback rather
 * than a venue lookup: the Hosted Experience's read RPC (get_wedding_website)
 * is couple-content-only by design (this page is the couple's own aesthetic
 * system, not venue-branded) and a browser-tab icon is chrome, not worth
 * extending that RPC's shape for.
 */
export default async function Icon() {
  return venueFaviconResponse(null);
}
