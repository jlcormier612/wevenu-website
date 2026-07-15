/**
 * Availability data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { BOOKING_SCHEDULE_TYPES } from "@/lib/availability/types";
import type {
  AvailabilityStatus,
  CalendarBlock,
  CalendarBlockInput,
  ConflictItem,
  DateHold,
  DateHoldInput,
  SpaceInput,
  VenueCapacityRules,
  VenueSpace,
} from "@/lib/availability/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type SpaceRow = { id: string; venue_id: string; name: string; description: string | null; capacity: number | null; is_active: boolean; sort_order: number; created_at: string; updated_at: string; };
type RulesRow = { id: string; venue_id: string; max_simultaneous_events: number; max_simultaneous_tours: number; min_turnaround_hours: number; created_at: string; updated_at: string; };
type HoldRow = { id: string; venue_id: string; lead_id: string | null; space_id: string | null; title: string; hold_date: string; start_time: string | null; end_time: string | null; status: DateHold["status"]; expires_at: string | null; notes: string | null; created_at: string; updated_at: string; leads?: { first_name: string; last_name: string } | null; venue_spaces?: { name: string } | null; };
type BlockRow = { id: string; venue_id: string; title: string; type: CalendarBlock["type"]; reason: CalendarBlock["reason"]; start_date: string; end_date: string; is_all_day: boolean; start_time: string | null; end_time: string | null; notes: string | null; recurrence_rule: string; recurrence_ends_on: string | null; created_at: string; event_type: string | null; client_name: string | null; guest_count: number | null; estimated_revenue: number | string | null; converted_lead_id: string | null; };

const mapSpace = (r: SpaceRow): VenueSpace => ({ id: r.id, venueId: r.venue_id, name: r.name, description: r.description, capacity: r.capacity, isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });
const mapRules = (r: RulesRow): VenueCapacityRules => ({ id: r.id, venueId: r.venue_id, maxSimultaneousEvents: r.max_simultaneous_events, maxSimultaneousTours: r.max_simultaneous_tours, minTurnaroundHours: Number(r.min_turnaround_hours), createdAt: r.created_at, updatedAt: r.updated_at });
const mapHold = (r: HoldRow): DateHold => ({ id: r.id, venueId: r.venue_id, leadId: r.lead_id, spaceId: r.space_id, title: r.title, holdDate: r.hold_date, startTime: r.start_time?.slice(0, 5) ?? null, endTime: r.end_time?.slice(0, 5) ?? null, status: r.status, expiresAt: r.expires_at, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, leadName: r.leads ? `${r.leads.first_name} ${r.leads.last_name}` : null, spaceName: r.venue_spaces?.name ?? null });
const mapBlock = (r: BlockRow): CalendarBlock => ({ id: r.id, venueId: r.venue_id, title: r.title, type: r.type, reason: r.reason, startDate: r.start_date, endDate: r.end_date, isAllDay: r.is_all_day, startTime: r.start_time?.slice(0, 5) ?? null, endTime: r.end_time?.slice(0, 5) ?? null, notes: r.notes, recurrenceRule: (r.recurrence_rule ?? "none") as CalendarBlock["recurrenceRule"], recurrenceEndsOn: r.recurrence_ends_on ?? null, createdAt: r.created_at, eventType: r.event_type, clientName: r.client_name, guestCount: r.guest_count, estimatedRevenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null, convertedLeadId: r.converted_lead_id });

// ---- Spaces ------------------------------------------------------------------

export async function getSpaces(client: DbClient, venueId: string): Promise<VenueSpace[]> {
  const { data, error } = await client.from("venue_spaces").select("*").eq("venue_id", venueId).order("sort_order").order("name");
  if (error) throw error;
  return (data as SpaceRow[]).map(mapSpace);
}

export async function insertSpace(client: DbClient, venueId: string, input: SpaceInput): Promise<string> {
  const { data, error } = await client.from("venue_spaces")
    .insert({ venue_id: venueId, name: input.name.trim(), description: input.description.trim() || null, capacity: input.capacity.trim() ? parseInt(input.capacity, 10) : null, is_active: input.isActive })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateSpace(client: DbClient, venueId: string, spaceId: string, input: SpaceInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("venue_spaces") as any).update({ name: input.name.trim(), description: input.description.trim() || null, capacity: input.capacity.trim() ? parseInt(input.capacity, 10) : null, is_active: input.isActive }).eq("id", spaceId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteSpace(client: DbClient, venueId: string, spaceId: string): Promise<void> {
  const { error } = await client.from("venue_spaces").delete().eq("id", spaceId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Capacity Rules ----------------------------------------------------------

export async function getCapacityRules(client: DbClient, venueId: string): Promise<VenueCapacityRules | null> {
  const { data, error } = await client.from("venue_capacity_rules").select("*").eq("venue_id", venueId).maybeSingle<RulesRow>();
  if (error) throw error;
  return data ? mapRules(data) : null;
}

export async function upsertCapacityRules(client: DbClient, venueId: string, input: { maxSimultaneousEvents: number; maxSimultaneousTours: number; minTurnaroundHours: number }): Promise<void> {
  const { error } = await client.from("venue_capacity_rules").upsert({ venue_id: venueId, max_simultaneous_events: input.maxSimultaneousEvents, max_simultaneous_tours: input.maxSimultaneousTours, min_turnaround_hours: input.minTurnaroundHours }, { onConflict: "venue_id" });
  if (error) throw error;
}

// ---- Date Holds -------------------------------------------------------------

export async function getHolds(client: DbClient, venueId: string, opts?: { leadId?: string; activeOnly?: boolean }): Promise<DateHold[]> {
  let q = client.from("date_holds").select("*, leads(first_name, last_name), venue_spaces(name)").eq("venue_id", venueId);
  if (opts?.leadId) q = q.eq("lead_id", opts.leadId);
  if (opts?.activeOnly) q = q.eq("status", "active");
  const { data, error } = await q.order("hold_date").order("created_at");
  if (error) throw error;
  return (data as unknown as HoldRow[]).map(mapHold);
}

export async function getHoldsForDates(client: DbClient, venueId: string, start: string, end: string): Promise<DateHold[]> {
  const { data, error } = await client.from("date_holds").select("*, leads(first_name, last_name), venue_spaces(name)")
    .eq("venue_id", venueId).eq("status", "active")
    .gte("hold_date", start).lte("hold_date", end);
  if (error) throw error;
  return (data as unknown as HoldRow[]).map(mapHold);
}

export async function insertHold(client: DbClient, venueId: string, input: DateHoldInput): Promise<string> {
  const { data, error } = await client.from("date_holds")
    .insert({ venue_id: venueId, lead_id: input.leadId || null, space_id: input.spaceId || null, title: input.title.trim(), hold_date: input.holdDate, start_time: input.startTime || null, end_time: input.endTime || null, expires_at: input.expiresAt || null, notes: input.notes.trim() || null })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateHoldStatus(client: DbClient, venueId: string, holdId: string, status: DateHold["status"]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("date_holds") as any).update({ status }).eq("id", holdId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteHold(client: DbClient, venueId: string, holdId: string): Promise<void> {
  const { error } = await client.from("date_holds").delete().eq("id", holdId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Calendar Blocks --------------------------------------------------------

export async function getBlocks(client: DbClient, venueId: string): Promise<CalendarBlock[]> {
  const { data, error } = await client.from("calendar_blocks").select("*").eq("venue_id", venueId).order("start_date");
  if (error) throw error;
  return (data as BlockRow[]).map(mapBlock);
}

export async function getBlock(client: DbClient, venueId: string, blockId: string): Promise<CalendarBlock | null> {
  const { data, error } = await client.from("calendar_blocks").select("*")
    .eq("id", blockId).eq("venue_id", venueId).maybeSingle<BlockRow>();
  if (error) throw error;
  return data ? mapBlock(data) : null;
}

export async function getBlocksForDates(client: DbClient, venueId: string, start: string, end: string): Promise<CalendarBlock[]> {
  const { data, error } = await client.from("calendar_blocks").select("*")
    .eq("venue_id", venueId).lte("start_date", end).gte("end_date", start);
  if (error) throw error;
  return (data as BlockRow[]).map(mapBlock);
}

export async function insertBlock(client: DbClient, venueId: string, input: CalendarBlockInput): Promise<string> {
  const isBooking = BOOKING_SCHEDULE_TYPES.includes(input.type);
  const { data, error } = await client.from("calendar_blocks")
    .insert({
      venue_id: venueId, title: input.title.trim(), type: input.type,
      // reason only means something for Blocked Time — every other manual
      // type has no sub-reason concept.
      reason: input.type === "blocked_time" ? input.reason : null,
      start_date: input.startDate, end_date: input.endDate || input.startDate, is_all_day: input.isAllDay,
      start_time: (!input.isAllDay && input.startTime) ? input.startTime : null,
      end_time: (!input.isAllDay && input.endTime) ? input.endTime : null,
      notes: input.notes.trim() || null, recurrence_rule: input.recurrenceRule ?? "none",
      recurrence_ends_on: (input.recurrenceRule && input.recurrenceRule !== "none" && input.recurrenceEndsOn) ? input.recurrenceEndsOn : null,
      // Calendar Booking Placeholder fields — only ever set for the two
      // Bookings types; every other manual type leaves them all null.
      event_type: isBooking ? (input.eventType.trim() || null) : null,
      client_name: isBooking ? (input.clientName.trim() || null) : null,
      guest_count: isBooking && input.guestCount.trim() ? parseInt(input.guestCount, 10) : null,
      estimated_revenue: isBooking && input.estimatedRevenue.trim() ? Number(input.estimatedRevenue.replace(/[$,]/g, "")) : null,
    })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function deleteBlock(client: DbClient, venueId: string, blockId: string): Promise<void> {
  const { error } = await client.from("calendar_blocks").delete().eq("id", blockId).eq("venue_id", venueId);
  if (error) throw error;
}

/** "Convert to Booking" — marks a Booking placeholder as resolved into a real Lead. The placeholder row stays, as a record of where the date's booking came from, rather than being deleted. */
export async function markBlockConverted(client: DbClient, venueId: string, blockId: string, leadId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("calendar_blocks") as any)
    .update({ converted_lead_id: leadId }).eq("id", blockId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- Conflict detection -----------------------------------------------------

/**
 * Check whether a date/time slot has conflicts.
 * Returns warnings (not hard blocks) — venues manage their own exceptions.
 */
export async function checkAvailability(
  client: DbClient,
  venueId: string,
  opts: {
    date: string;
    startTime?: string;
    endTime?: string;
    spaceId?: string;
    type: "event" | "tour";
    excludeId?: string; // exclude the current event/lead when editing
  },
): Promise<AvailabilityStatus> {
  const conflicts: ConflictItem[] = [];

  // 1. Check calendar blocks — hard error, not a warning.
  //    A blocked date cannot be booked. The coordinator must remove the block first.
  const { data: blocks } = await client.from("calendar_blocks").select("title")
    .eq("venue_id", venueId).lte("start_date", opts.date).gte("end_date", opts.date);
  if (blocks && blocks.length > 0) {
    conflicts.push({ type: "calendar_blocked", message: `Date is blocked: ${(blocks[0] as { title: string }).title}`, severity: "error" });
  }

  // 2. Check active, non-expired holds on this date (informational). TR-B5:
  // expires_at was never checked here, so an expired hold kept blocking
  // indefinitely until a human manually released it.
  const { data: holds } = await client.from("date_holds").select("title")
    .eq("venue_id", venueId).eq("hold_date", opts.date).eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  if (holds && holds.length > 0) {
    conflicts.push({ type: "hold_exists", message: `${holds.length} active hold(s) on this date`, severity: "warning" });
  }

  // 3. Capacity check — count events on this date
  const rules = await getCapacityRules(client, venueId);
  if (rules) {
    const eventsQuery = client.from("events").select("id")
      .eq("venue_id", venueId).eq("event_date", opts.date)
      .not("status", "in", "(cancelled)");
    if (opts.excludeId) eventsQuery.neq("id", opts.excludeId);
    const { data: dayEvents } = await eventsQuery;
    const eventCount = dayEvents?.length ?? 0;

    if (opts.type === "event" && eventCount >= rules.maxSimultaneousEvents) {
      conflicts.push({
        type: "event_capacity_full",
        message: `Maximum simultaneous events (${rules.maxSimultaneousEvents}) reached for this date`,
        severity: "warning",
      });
    }
    if (opts.type === "tour") {
      // Program 2 Phase 1a: tour_appointments is the canonical source —
      // this used to read leads.tour_date/tour_completed directly, which
      // silently undercounted tour capacity for any tour booked through the
      // public widget rather than entered manually on the lead.
      let toursQuery = client.from("tour_appointments").select("id, lead_id")
        .eq("venue_id", venueId)
        .gte("scheduled_at", `${opts.date}T00:00:00`)
        .lte("scheduled_at", `${opts.date}T23:59:59`)
        .not("status", "in", "(cancelled,completed,no_show)");
      if (opts.excludeId) toursQuery = toursQuery.neq("lead_id", opts.excludeId);
      const { data: dayTours } = await toursQuery;
      const leadIds = (dayTours ?? [])
        .map((t) => (t as { lead_id: string | null }).lead_id)
        .filter((id): id is string => !!id);
      let tourCount = leadIds.length;
      if (leadIds.length > 0) {
        const { data: activeLeads } = await client.from("leads").select("id")
          .in("id", leadIds).not("status", "in", "(won,lost,cancelled)");
        tourCount = activeLeads?.length ?? 0;
      }
      if (tourCount >= rules.maxSimultaneousTours) {
        conflicts.push({
          type: "tour_capacity_full",
          message: `Maximum simultaneous tours (${rules.maxSimultaneousTours}) reached for this date`,
          severity: "warning",
        });
      }
    }
  }

  // 4. Space availability
  if (opts.spaceId && opts.type === "event") {
    const spaceEventsQ = client.from("events").select("id")
      .eq("venue_id", venueId).eq("space_id", opts.spaceId).eq("event_date", opts.date)
      .not("status", "in", "(cancelled)");
    if (opts.excludeId) spaceEventsQ.neq("id", opts.excludeId);
    const { data: spaceEvents } = await spaceEventsQ;
    if (spaceEvents && spaceEvents.length > 0) {
      conflicts.push({ type: "space_booked", message: "This space is already booked on this date", severity: "warning" });
    }
  }

  return { available: conflicts.filter((c) => c.severity === "error").length === 0, conflicts };
}
