/**
 * Write-through: secured event_vendor_assignments → vendor_availability.
 *
 * Source of truth for "Booked" is the assignment + non-cancelled event date
 * range (event_date … coalesce(event_end_date, event_date)). Inquiry/pending
 * alone never create rows. Failures are best-effort — never block assignment
 * or event mutations.
 */
import { createAdminClient } from "@/integrations/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

function tryAdmin(): AdminClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function swallow(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[vendor-availability-sync] ${label}`, err);
  }
}

export type BookedAvailabilityRef = {
  assignmentId: string;
  vendorId: string;
  eventDate: string | null;
  /** Inclusive end; null/undefined/equal to start = single day. */
  eventEndDate?: string | null;
  eventName: string;
  eventStatus?: string | null;
};

function isSecured(ref: BookedAvailabilityRef): boolean {
  if (!ref.eventDate) return false;
  if (ref.eventStatus && ref.eventStatus === "cancelled") return false;
  return true;
}

/** Inclusive YYYY-MM-DD dates from start through end (or start alone). */
export function datesInEventRange(start: string, end?: string | null): string[] {
  const last = end && end > start ? end : start;
  const dates: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const stop = new Date(`${last}T12:00:00`);
  while (cur <= stop) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Upsert event-sourced Booked rows for every day in the secured range. */
export async function markAssignmentBooked(ref: BookedAvailabilityRef): Promise<void> {
  await swallow("markAssignmentBooked", async () => {
    const admin = tryAdmin();
    if (!admin || !isSecured(ref)) return;

    const note = ref.eventName.trim() || "Booked event";
    const dates = datesInEventRange(ref.eventDate!, ref.eventEndDate);

    // Replace the whole range so date moves / shrinks / expands stay clean.
    const { error: delError } = await admin
      .from("vendor_availability")
      .delete()
      .eq("source", "event")
      .eq("source_id", ref.assignmentId);
    if (delError) throw delError;

    const { error } = await admin.from("vendor_availability").insert(
      dates.map((date) => ({
        vendor_id:  ref.vendorId,
        date,
        is_blocked: true,
        note,
        source:     "event",
        source_id:  ref.assignmentId,
      })),
    );
    if (error) throw error;
  });
}

/** Remove all event-sourced rows for an assignment (if present). */
export async function clearAssignmentBooked(assignmentId: string): Promise<void> {
  await swallow("clearAssignmentBooked", async () => {
    const admin = tryAdmin();
    if (!admin) return;
    const { error } = await admin
      .from("vendor_availability")
      .delete()
      .eq("source", "event")
      .eq("source_id", assignmentId);
    if (error) throw error;
  });
}

/**
 * After event date/range, name, or status change: move/clear Booked rows for
 * every assignment on that event.
 */
export async function syncEventVendorAvailability(
  eventId: string,
  opts: {
    eventDate: string | null;
    eventEndDate?: string | null;
    eventName: string;
    status: string;
  },
): Promise<void> {
  await swallow("syncEventVendorAvailability", async () => {
    const admin = tryAdmin();
    if (!admin) return;

    const { data: assignments, error } = await admin
      .from("event_vendor_assignments")
      .select("id, vendor_id")
      .eq("event_id", eventId);
    if (error) throw error;

    const rows = (assignments ?? []) as Array<{ id: string; vendor_id: string }>;
    if (rows.length === 0) return;

    if (opts.status === "cancelled" || !opts.eventDate) {
      await Promise.all(rows.map((r) => clearAssignmentBooked(r.id)));
      return;
    }

    await Promise.all(
      rows.map((r) =>
        markAssignmentBooked({
          assignmentId: r.id,
          vendorId:     r.vendor_id,
          eventDate:    opts.eventDate,
          eventEndDate: opts.eventEndDate,
          eventName:    opts.eventName,
          eventStatus:  opts.status,
        }),
      ),
    );
  });
}

type SecuredAssignmentRow = {
  id: string;
  vendor_id: string;
  events: {
    event_date: string | null;
    event_end_date: string | null;
    name: string;
    status: string;
  } | null;
};

function rangesOverlap(
  aStart: string, aEnd: string, bStart: string, bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

/**
 * Safety-net repair for a vendor's calendar month: upsert missing Booked
 * rows and drop orphaned event-sourced rows in range.
 */
export async function reconcileVendorEventAvailability(
  vendorId: string,
  start: string,
  end: string,
): Promise<void> {
  await swallow("reconcileVendorEventAvailability", async () => {
    const admin = tryAdmin();
    if (!admin) return;

    const { data: assignments, error } = await admin
      .from("event_vendor_assignments")
      .select("id, vendor_id, events!inner(event_date, event_end_date, name, status)")
      .eq("vendor_id", vendorId);
    if (error) throw error;

    const secured = ((assignments ?? []) as unknown as SecuredAssignmentRow[]).filter((r) => {
      const eventStart = r.events?.event_date ?? null;
      if (!eventStart) return false;
      if (r.events?.status === "cancelled") return false;
      const eventEnd = r.events?.event_end_date && r.events.event_end_date > eventStart
        ? r.events.event_end_date
        : eventStart;
      return rangesOverlap(eventStart, eventEnd, start, end);
    });
    const securedIds = new Set(secured.map((r) => r.id));

    await Promise.all(
      secured.map((r) =>
        markAssignmentBooked({
          assignmentId: r.id,
          vendorId:     r.vendor_id,
          eventDate:    r.events?.event_date ?? null,
          eventEndDate: r.events?.event_end_date ?? null,
          eventName:    r.events?.name ?? "Booked event",
          eventStatus:  r.events?.status ?? null,
        }),
      ),
    );

    const { data: eventRows, error: listError } = await admin
      .from("vendor_availability")
      .select("id, source_id")
      .eq("vendor_id", vendorId)
      .eq("source", "event")
      .gte("date", start)
      .lte("date", end);
    if (listError) throw listError;

    const orphans = ((eventRows ?? []) as Array<{ id: string; source_id: string | null }>)
      .filter((r) => r.source_id && !securedIds.has(r.source_id))
      .map((r) => r.id);

    if (orphans.length > 0) {
      const { error: delError } = await admin.from("vendor_availability").delete().in("id", orphans);
      if (delError) throw delError;
    }
  });
}
