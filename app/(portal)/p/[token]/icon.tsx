import { resolvePortalContext } from "@/lib/portal/service";
import { venueFaviconResponse, faviconSize, faviconContentType } from "@/lib/venue-brand/favicon";

export const size = faviconSize;
export const contentType = faviconContentType;

export default async function Icon({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await resolvePortalContext(token);
  return venueFaviconResponse(ctx?.venue.logoUrl);
}
