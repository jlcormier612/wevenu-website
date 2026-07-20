import { getContractByToken } from "@/lib/contracts/service";
import { venueFaviconResponse, faviconSize, faviconContentType } from "@/lib/venue-brand/favicon";

export const size = faviconSize;
export const contentType = faviconContentType;

export default async function Icon({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const contract = await getContractByToken(token);
  return venueFaviconResponse(contract?.venue?.logoUrl);
}
