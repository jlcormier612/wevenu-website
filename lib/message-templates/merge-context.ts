/**
 * Live tour + payment merge context for Message Templates.
 * Reads authoritative tables only — never duplicates into the template row.
 */
import { formatDate, formatMoney } from "@/lib/payments/constants";
import { getVenueTimezone, utcToVenueLocalParts } from "@/lib/venue/timezone";

type AnyDbClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export function formatTourDatetimeForCustomer(scheduledAtIso: string, timezone: string | null): string {
  const tz = timezone || "America/New_York";
  const instant = new Date(scheduledAtIso);
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(instant);
  } catch {
    const { date, time } = utcToVenueLocalParts(scheduledAtIso, timezone);
    return `${date} at ${time}`;
  }
}

/**
 * Resolve a tour appointment for merge. Prefer an explicit appointment id
 * (must belong to this venue + relationship's lead). Otherwise pick the
 * soonest upcoming non-cancelled appointment for the lead. Cancelled /
 * completed / no_show are never used — prevents stale appointment times
 * after reschedule (old row cancelled or superseded).
 */
export async function resolveTourDatetimeForRelationship(
  client: AnyDbClient,
  venueId: string,
  relationshipId: string,
  tourAppointmentId?: string | null,
): Promise<string | null> {
  const timezone = await getVenueTimezone(client, venueId);

  if (tourAppointmentId) {
    const { data: lead } = await client.from("leads")
      .select("id")
      .eq("relationship_id", relationshipId)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (!lead?.id) return null;

    const { data: appt } = await client.from("tour_appointments")
      .select("id, scheduled_at, status, lead_id, venue_id")
      .eq("id", tourAppointmentId)
      .eq("venue_id", venueId)
      .eq("lead_id", lead.id)
      .maybeSingle();
    if (!appt?.scheduled_at) return null;
    if (["cancelled", "completed", "no_show"].includes(appt.status)) return null;
    return formatTourDatetimeForCustomer(appt.scheduled_at, timezone);
  }

  const { data: lead } = await client.from("leads")
    .select("id")
    .eq("relationship_id", relationshipId)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!lead?.id) return null;

  const nowIso = new Date().toISOString();
  const { data: upcoming } = await client.from("tour_appointments")
    .select("scheduled_at, status")
    .eq("venue_id", venueId)
    .eq("lead_id", lead.id)
    .not("status", "in", "(cancelled,completed,no_show)")
    .gte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (upcoming?.scheduled_at) {
    return formatTourDatetimeForCustomer(upcoming.scheduled_at, timezone);
  }

  // Most recent past active tour (for follow-up templates) — still live row,
  // not a cancelled history row.
  const { data: recent } = await client.from("tour_appointments")
    .select("scheduled_at, status")
    .eq("venue_id", venueId)
    .eq("lead_id", lead.id)
    .not("status", "in", "(cancelled,no_show)")
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.scheduled_at) {
    return formatTourDatetimeForCustomer(recent.scheduled_at, timezone);
  }
  return null;
}

export type ResolvedPaymentMerge = {
  paymentLabel: string;
  paymentAmount: string;
  paymentDueDate: string;
};

/**
 * Resolve payment merge fields from payment_line_items, scoped to venue +
 * the client on this relationship. Prefer an explicit line id. Otherwise
 * pick the soonest unpaid/overdue/processing line by due_date.
 */
export async function resolvePaymentMergeForRelationship(
  client: AnyDbClient,
  venueId: string,
  relationshipId: string,
  paymentLineItemId?: string | null,
): Promise<ResolvedPaymentMerge | null> {
  const { data: clientRow } = await client.from("clients")
    .select("id")
    .eq("relationship_id", relationshipId)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!clientRow?.id) return null;

  const { data: schedules } = await client.from("payment_schedules")
    .select("id")
    .eq("venue_id", venueId)
    .eq("client_id", clientRow.id);
  const scheduleIds = ((schedules ?? []) as { id: string }[]).map((s) => s.id);
  if (scheduleIds.length === 0) return null;

  if (paymentLineItemId) {
    const { data: line } = await client.from("payment_line_items")
      .select("id, venue_id, schedule_id, label, amount, due_date, status")
      .eq("id", paymentLineItemId)
      .eq("venue_id", venueId)
      .maybeSingle();
    if (!line) return null;
    if (!scheduleIds.includes(line.schedule_id)) return null;
    if (!line.due_date) return null;
    return {
      paymentLabel: line.label,
      paymentAmount: formatMoney(line.amount),
      paymentDueDate: formatDate(line.due_date),
    };
  }

  const { data: lines } = await client.from("payment_line_items")
    .select("id, label, amount, due_date, status, schedule_id")
    .eq("venue_id", venueId)
    .in("schedule_id", scheduleIds)
    .in("status", ["pending", "overdue", "processing"])
    .not("due_date", "is", null)
    .order("due_date", { ascending: true })
    .limit(1);

  const line = (lines ?? [])[0] as {
    label: string; amount: number; due_date: string;
  } | undefined;
  if (!line?.due_date) return null;

  return {
    paymentLabel: line.label,
    paymentAmount: formatMoney(line.amount),
    paymentDueDate: formatDate(line.due_date),
  };
}
