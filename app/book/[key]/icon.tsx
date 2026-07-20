import { getVenueByTourKey } from "@/lib/tours/service";
import { venueFaviconResponse, faviconSize, faviconContentType } from "@/lib/venue-brand/favicon";

export const size = faviconSize;
export const contentType = faviconContentType;

export default async function Icon({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const venue = await getVenueByTourKey(key);
  return venueFaviconResponse(venue?.logoUrl);
}
