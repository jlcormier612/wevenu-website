/**
 * Availability data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { BOOKING_SCHEDULE_TYPES } from "@/lib/availability/types";
import type { OccupancyInput, OccupancyResult } from "@/lib/availability/event-occupancy";
import { persistScheduleItemTimes } from "@/lib/calendar/schedule-item-times";
import { mapCalendarBlockRow } from "@/lib/availability/calendar-block-coverage";
import { effectiveMinTurnaroundHours, protectedEndDate } from "@/lib/availability/event-occupancy";
import { buildAvailabilityConflicts } from "@/lib/availability/precheck";
import { venueLocalToUtcIso } from "@/lib/venue/timezone";
import type {
  AvailabilityStatus,
  CalendarBlock,
  CalendarBlockInput,
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
type BlockRow = { id: string; venue_id: string; title: string; type: CalendarBlock["type"]; reason: CalendarBlock["reason"]; start_date: string; end_date: string; is_all_day: boolean; start_time: string | null; end_time: string | null; notes: string | null; recurrence_rule: string; recurrence_ends_on: string | null; recurrence_interval: number | null; recurrence_count: number | null; lead_id: string | null; client_id: string | null; created_at: string; event_type: string | null; client_name: string | null; guest_count: number | null; estimated_revenue: number | string | null; converted_lead_id: string | null; };

const mapSpace = (r: SpaceRow): VenueSpace => ({ id: r.id, venueId: r.venue_id, name: r.name, description: r.description, capacity: r.capacity, isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at });
const mapRules = (r: RulesRow): VenueCapacityRules => ({ id: r.id, venueId: r.venue_id, maxSimultaneousEvents: r.max_simultaneous_events, maxSimultaneousTours: r.max_simultaneous_tours, minTurnaroundHours: Number(r.min_turnaround_hours), createdAt: r.created_at, updatedAt: r.updated_at });
const mapHold = (r: HoldRow): DateHold => ({ id: r.id, venueId: r.venue_id, leadId: r.lead_id, spaceId: r.space_id, title: r.title, holdDate: r.hold_date, startTime: r.start_time?.slice(0, 5) ?? null, endTime: r.end_time?.slice(0, 5) ?? null, status: r.status, expiresAt: r.expires_at, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at, leadName: r.leads ? `${r.leads.first_name} ${r.leads.last_name}` : null, spaceName: r.venue_spaces?.name ?? null });
const mapBlock = (r: BlockRow): CalendarBlock => ({ id: r.id, venueId: r.venue_id, title: r.title, type: r.type, reason: r.reason, startDate: r.start_date, endDate: r.end_date, isAllDay: r.is_all_day, startTime: r.start_time?.slice(0, 5) ?? null, endTime: r.end_time?.slice(0, 5) ?? null, notes: r.notes, recurrenceRule: (r.recurrence_rule ?? "none") as CalendarBlock["recurrenceRule"], recurrenceEndsOn: r.recurrence_ends_on ?? null, recurrenceInterval: r.recurrence_interval ?? 1, recurrenceCount: r.recurrence_count ?? null, leadId: r.lead_id ?? null, clientId: r.client_id ?? null, createdAt: r.created_at, eventType: r.event_type, clientName: r.client_name, guestCount: r.guest_count, estimatedRevenue: r.estimated_revenue != null ? Number(r.estimated_revenue) : null, convertedLeadId: r.converted_lead_id });

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

/**
 * K.7 Phase 2 — occupancy assert RPC. Writes must NOT call this as a
 * standalone round trip; Phase 3 enforces occupancy via the
 * events_enforce_availability trigger in the same transaction as INSERT/
 * UPDATE. This helper remains for tests and diagnostics.
 */
export async function assertEventAvailability(
  client: DbClient,
  venueId: string,
  input: OccupancyInput,
): Promise<OccupancyResult> {
  const { data, error } = await client.rpc("assert_event_availability", {
    p_venue_id: venueId,
    p_event_date: input.eventDate,
    p_event_end_date: input.eventEndDate?.trim() || null,
    p_setup_time: input.setupTime?.trim() || null,
    p_start_time: input.startTime?.trim() || null,
    p_end_time: input.endTime?.trim() || null,
    p_teardown_time: input.teardownTime?.trim() || null,
    p_space_id: input.spaceId?.trim() || null,
    p_exclude_event_id: input.excludeEventId?.trim() || null,
  });
  if (error) throw error;
  const row = data as OccupancyResult | null;
  if (!row || typeof row !== "object" || !("ok" in row)) {
    throw new Error("assert_event_availability returned an unexpected payload.");
  }
  return row;
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
  // Series rows whose first span overlaps [start,end], plus recurring series
  // that started on or before `end` and have not ended before `start`.
  // Callers that need occurrence-level coverage must run coveringCalendarBlockTitle.
  const { data, error } = await client.from("calendar_blocks").select("*")
    .eq("venue_id", venueId)
    .or(`and(start_date.lte.${end},end_date.gte.${start},recurrence_rule.eq.none),and(recurrence_rule.neq.none,start_date.lte.${end},or(recurrence_ends_on.is.null,recurrence_ends_on.gte.${start}))`);
  if (error) throw error;
  return (data as BlockRow[]).map(mapBlock);
}

/**
 * The full column set for a manual Schedule Item, shared by insert and update
 * so an edit can never persist a different shape than a create — the two
 * drifting apart is exactly how "edit quietly drops a field" bugs happen.
 */
function blockColumns(input: CalendarBlockInput) {
  const isBooking = BOOKING_SCHEDULE_TYPES.includes(input.type);
  const repeats = !!input.recurrenceRule && input.recurrenceRule !== "none";
  // A date end and a count end are mutually exclusive (DB constraint
  // calendar_blocks_recurrence_end_one_of); the date wins when a caller
  // somehow supplies both, matching the form, which only ever sends one.
  const endsOn = repeats && input.recurrenceEndsOn ? input.recurrenceEndsOn : null;
  return {
    title: input.title.trim(), type: input.type,
    // reason only means something for Blocked Time — every other manual
    // type has no sub-reason concept.
    reason: input.type === "blocked_time" ? input.reason : null,
    start_date: input.startDate, end_date: input.endDate || input.startDate, is_all_day: input.isAllDay,
    ...persistScheduleItemTimes(input.isAllDay, input.startTime, input.endTime),
    notes: input.notes.trim() || null,
    recurrence_rule: input.recurrenceRule ?? "none",
    recurrence_ends_on: endsOn,
    recurrence_interval: repeats ? Math.max(1, Math.trunc(input.recurrenceInterval ?? 1)) : 1,
    recurrence_count: repeats && !endsOn && input.recurrenceCount ? Math.max(1, Math.trunc(input.recurrenceCount)) : null,
    // "Related to" — at most one anchor, enforced in the DB too. A Client
    // link wins only when no Lead was chosen; the form is a single picker,
    // so in practice exactly one of these is ever populated.
    lead_id: input.leadId || null,
    client_id: input.leadId ? null : (input.clientId || null),
    // Calendar Booking Placeholder fields — only ever set for the two
    // Bookings types; every other manual type leaves them all null.
    event_type: isBooking ? (input.eventType.trim() || null) : null,
    client_name: isBooking ? (input.clientName.trim() || null) : null,
    guest_count: isBooking && input.guestCount.trim() ? parseInt(input.guestCount, 10) : null,
    estimated_revenue: isBooking && input.estimatedRevenue.trim() ? Number(input.estimatedRevenue.replace(/[$,]/g, "")) : null,
  };
}

export async function insertBlock(client: DbClient, venueId: string, input: CalendarBlockInput): Promise<string> {
  const { data, error } = await client.from("calendar_blocks")
    .insert({ venue_id: venueId, ...blockColumns(input) })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateBlock(client: DbClient, venueId: string, blockId: string, input: CalendarBlockInput): Promise<void> {
  // venue_id is never in the update payload and is re-asserted in the filter —
  // an edit must not be able to move a schedule item to another venue.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("calendar_blocks") as any)
    .update(blockColumns(input)).eq("id", blockId).eq("venue_id", venueId);
  if (error) throw error;
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

export type CheckAvailabilityOpts = {
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  setupTime?: string;
  teardownTime?: string;
  spaceId?: string;
  type: "event" | "tour";
  excludeId?: string; // Event id when type=event; lead id when type=tour
  timezone?: string | null;
};

function shiftIsoDate(iso: string, days: number): string {
  const cur = new Date(`${iso}T12:00:00`);
  cur.setDate(cur.getDate() + days);
  const y = cur.getFullYear();
  const m = String(cur.getMonth() + 1).padStart(2, "0");
  const d = String(cur.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * User-facing pre-check. Occupancy / tour triggers remain write-path authority.
 * Missing venue_capacity_rules is treated as max 1 (never skipped / unlimited).
 */
export async function checkAvailability(
  client: DbClient,
  venueId: string,
  opts: CheckAvailabilityOpts,
): Promise<AvailabilityStatus> {
  const rangeEnd = opts.type === "event"
    ? protectedEndDate(opts.date, opts.endDate)
    : opts.date;

  const { data: venueRow } = await client.from("venues")
    .select("timezone, tour_duration_minutes")
    .eq("id", venueId)
    .maybeSingle<{ timezone: string | null; tour_duration_minutes: number | null }>();
  const timezone = opts.timezone ?? venueRow?.timezone ?? null;
  const tourDurationMinutes = venueRow?.tour_duration_minutes && venueRow.tour_duration_minutes > 0
    ? venueRow.tour_duration_minutes
    : 60;

  const blocksQuery = client.from("calendar_blocks")
    .select("title, type, start_date, end_date, is_all_day, start_time, end_time, recurrence_rule, recurrence_interval, recurrence_ends_on, recurrence_count")
    .eq("venue_id", venueId)
    .or(`and(start_date.lte.${rangeEnd},end_date.gte.${opts.date},recurrence_rule.eq.none),and(recurrence_rule.neq.none,start_date.lte.${rangeEnd},or(recurrence_ends_on.is.null,recurrence_ends_on.gte.${opts.date}))`);

  const holdsQuery = client.from("date_holds").select("title")
    .eq("venue_id", venueId).eq("hold_date", opts.date).eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  const rulesPromise = getCapacityRules(client, venueId);
  const spacesPromise = client.from("venue_spaces").select("id, is_active").eq("venue_id", venueId);

  const rulesForLook = await rulesPromise;
  const extraDays = opts.type === "event"
    ? Math.ceil(effectiveMinTurnaroundHours(rulesForLook) / 24)
    : 0;
  const eventLookStart = opts.type === "tour"
    ? shiftIsoDate(opts.date, -1)
    : shiftIsoDate(opts.date, extraDays > 0 ? -extraDays : 0);
  const eventLookEnd = opts.type === "tour"
    ? shiftIsoDate(opts.date, 1)
    : shiftIsoDate(rangeEnd, extraDays > 0 ? extraDays : 0);
  let eventsQuery = client.from("events")
    .select("id, name, status, event_date, event_end_date, space_id, setup_time, start_time, end_time, teardown_time")
    .eq("venue_id", venueId)
    .not("status", "in", "(cancelled)")
    .lte("event_date", eventLookEnd)
    .or(`event_end_date.gte.${eventLookStart},and(event_end_date.is.null,event_date.gte.${eventLookStart})`);

  const dayStartIso = venueLocalToUtcIso(opts.date, "00:00", timezone);
  const dayStartMs = Date.parse(dayStartIso);
  const lookbehindIso = new Date(dayStartMs - 36 * 60 * 60 * 1000).toISOString();
  const lookaheadIso = new Date(dayStartMs + 36 * 60 * 60 * 1000).toISOString();
  const toursPromise = opts.type === "tour"
    ? client.from("tour_appointments")
      .select("id, lead_id, status, scheduled_at, duration_minutes")
      .eq("venue_id", venueId)
      .not("status", "eq", "cancelled")
      .gte("scheduled_at", lookbehindIso)
      .lte("scheduled_at", lookaheadIso)
    : Promise.resolve({ data: [] as unknown[] });

  const exceptionsPromise = opts.type === "tour"
    ? client.from("tour_availability_exceptions").select("label")
      .eq("venue_id", venueId)
      .lte("start_date", opts.date)
      .gte("end_date", opts.date)
      .limit(1)
    : Promise.resolve({ data: [] as unknown[] });

  const windowsPromise = opts.type === "tour"
    ? client.from("tour_availability_windows").select("day_of_week, start_time, end_time")
      .eq("venue_id", venueId)
    : Promise.resolve({ data: [] as unknown[] });

  const [blocksRes, holdsRes, rules, spacesRes, eventsRes, toursRes, exceptionsRes, windowsRes] = await Promise.all([
    blocksQuery,
    holdsQuery,
    rulesPromise,
    spacesPromise,
    eventsQuery,
    toursPromise,
    exceptionsPromise,
    windowsPromise,
  ]);

  const spaces = (spacesRes.data ?? []) as { id: string; is_active: boolean }[];
  const events = ((eventsRes.data ?? []) as {
    id: string; name: string | null; status: string;
    event_date: string; event_end_date: string | null; space_id: string | null;
    setup_time: string | null; start_time: string | null; end_time: string | null; teardown_time: string | null;
  }[]).map((e) => ({
    id: e.id,
    name: e.name ?? undefined,
    status: e.status,
    eventDate: e.event_date,
    eventEndDate: e.event_end_date,
    spaceId: e.space_id,
    setupTime: e.setup_time,
    startTime: e.start_time,
    endTime: e.end_time,
    teardownTime: e.teardown_time,
  }));

  const tours = ((toursRes.data ?? []) as {
    id: string; lead_id: string | null; status: string; scheduled_at: string; duration_minutes: number;
  }[]).map((t) => ({
    id: t.id,
    leadId: t.lead_id,
    status: t.status,
    scheduledAtMs: Date.parse(t.scheduled_at),
    durationMinutes: t.duration_minutes,
  }));

  const exceptionRow = ((exceptionsRes.data ?? []) as { label: string | null }[])[0];
  const tourWindows = ((windowsRes.data ?? []) as { day_of_week: number; start_time: string; end_time: string }[])
    .map((w) => ({
      dayOfWeek: w.day_of_week,
      startTime: w.start_time.slice(0, 5),
      endTime: w.end_time.slice(0, 5),
    }));
  const tourScheduledAtMs = opts.type === "tour" && opts.startTime
    ? Date.parse(venueLocalToUtcIso(opts.date, opts.startTime, timezone))
    : undefined;

  return buildAvailabilityConflicts(
    {
      date: opts.date,
      endDate: opts.endDate,
      startTime: opts.startTime,
      endTime: opts.endTime,
      setupTime: opts.setupTime,
      teardownTime: opts.teardownTime,
      spaceId: opts.spaceId,
      type: opts.type,
      excludeId: opts.excludeId,
      tourScheduledAtMs,
      tourDurationMinutes,
      timezone,
    },
    {
      calendarBlocks: ((blocksRes.data ?? []) as {
        title: string; type: string; start_date: string; end_date: string;
        is_all_day?: boolean | null; start_time?: string | null; end_time?: string | null;
        recurrence_rule?: string | null; recurrence_interval?: number | null;
        recurrence_ends_on?: string | null; recurrence_count?: number | null;
      }[]).map(mapCalendarBlockRow),
      holdCount: (holdsRes.data ?? []).length,
      rules,
      events,
      activeSpaceIds: spaces.filter((s) => s.is_active).map((s) => s.id),
      allSpaceIds: spaces.map((s) => s.id),
      tours,
      tourExceptionLabel: exceptionRow ? (exceptionRow.label ?? "") : undefined,
      tourWindows: opts.type === "tour" ? tourWindows : undefined,
    },
  );
}
