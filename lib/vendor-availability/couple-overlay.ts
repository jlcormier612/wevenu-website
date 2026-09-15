import { resolvePortalContext } from "@/lib/portal/service";
import { coupleFacingOnly, lookupVendorsForEventDate, type CoupleFacingAvailability } from "@/lib/vendor-availability/lookup";

export async function overlayCoupleVendorAvailability<T extends { vendorId?: string }>(
  token: string,
  items: T[],
): Promise<{ eventDate: string | null; items: Array<T & { dateAvailability: CoupleFacingAvailability | null }> }> {
  const ctx = await resolvePortalContext(token);
  const eventDate = ctx?.event?.eventDate ?? null;
  if (!eventDate) {
    return { eventDate: null, items: items.map((item) => ({ ...item, dateAvailability: null })) };
  }
  const ids = items.map((item) => item.vendorId).filter((id): id is string => Boolean(id));
  const map = await lookupVendorsForEventDate(ids, eventDate);
  return {
    eventDate,
    items: items.map((item) => {
      const row = item.vendorId ? map.get(item.vendorId) : undefined;
      return { ...item, dateAvailability: row ? coupleFacingOnly(row) : null };
    }),
  };
}
