/**
 * Server lookup for couple-facing date availability.
 * Booked is derived from event_vendor_assignments + event dates (system of record).
 * Manual blocks come from vendor_availability source=manual.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { assignmentCoversDate, resolveVendorDateAvailability, type CoupleDateAvailability } from "@/lib/vendor-availability/query";

export async function lookupVendorsForEventDate(
  vendorIds: string[],
  eventDate: string,
): Promise<Map<string, CoupleDateAvailability>> {
  const unique = [...new Set(vendorIds.filter(Boolean))];
  const result = new Map<string, CoupleDateAvailability>();
  if (unique.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return result;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return result;
  }

  const [{ data: assignments }, { data: blockedRows }, { data: historyRows }] = await Promise.all([
    admin
      .from("event_vendor_assignments")
      .select("vendor_id, events!inner(event_date, event_end_date, status)")
      .in("vendor_id", unique),
    admin
      .from("vendor_availability")
      .select("vendor_id")
      .eq("source", "manual")
      .eq("is_blocked", true)
      .eq("date", eventDate)
      .in("vendor_id", unique),
    admin
      .from("vendor_availability")
      .select("vendor_id")
      .eq("source", "manual")
      .in("vendor_id", unique),
  ]);

  const booked = new Set<string>();
  for (const row of (assignments ?? []) as Array<{
    vendor_id: string;
    events: { event_date: string | null; event_end_date: string | null; status: string } | Array<{
      event_date: string | null; event_end_date: string | null; status: string;
    }>;
  }>) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!event || event.status === "cancelled") continue;
    if (assignmentCoversDate(event.event_date, event.event_end_date, eventDate)) {
      booked.add(row.vendor_id);
    }
  }

  const blocked = new Set((blockedRows ?? []).map((r) => r.vendor_id as string));
  const history = new Set((historyRows ?? []).map((r) => r.vendor_id as string));

  for (const vendorId of unique) {
    result.set(
      vendorId,
      resolveVendorDateAvailability({
        eventDate,
        eventBooked: booked.has(vendorId),
        manuallyBlocked: blocked.has(vendorId),
        vendorHasManualHistory: history.has(vendorId),
      }),
    );
  }
  return result;
}

export type CoupleFacingAvailability = {
  eventDate: string;
  status: CoupleDateAvailability["status"];
};

export function coupleFacingOnly(row: CoupleDateAvailability): CoupleFacingAvailability {
  return { eventDate: row.eventDate, status: row.status };
}
