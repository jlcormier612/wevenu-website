/**
 * Calendar application service (Sprint 17 → Calendar Integration → Slice 1).
 *
 * getCalendarData() aggregates venue-wide scheduled / reserved / blocked time
 * for one month. Calendar Slice 1 removed dated work (payments, follow-ups,
 * key dates, request dues, expirations) from this aggregation — those remain
 * on their owning surfaces and on Booking Schedule where appropriate.
 *
 * See lib/calendar/venue-calendar-scope.ts and lib/calendar/booking-schedule.ts.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { CalendarData, CalendarItem, ScheduleRelationOption } from "@/lib/calendar/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { eventTypeLabel, formatCurrency } from "@/lib/leads/constants";
import { getTourCalendarEntries } from "@/lib/tours/service";
import { blockReasonLabel } from "@/lib/availability/constants";
import { isBookingPlaceholder } from "@/lib/availability/types";
import type { ManualScheduleType, RecurrenceRule } from "@/lib/availability/types";
import { durationInDays, expandOccurrenceStarts, occurrenceDates } from "@/lib/calendar/recurrence";
import { calendarDatesForProtectedEvent } from "@/lib/calendar/event-display";
import { displayScheduleItemTimes } from "@/lib/calendar/schedule-item-times";
import { toScheduleRelationOption, type ScheduleRelationRow } from "@/lib/calendar/schedule-relation-search";

// Calendar Booking Placeholder — reserved/held time, not a booked Event.
function bookingPlaceholderSubtitle(guestCount: number | null, estimatedRevenue: number | string | null, convertedLeadId: string | null): string | null {
  const parts: string[] = ["Reserved date"];
  if (guestCount != null) parts.push(`${guestCount} guest${guestCount === 1 ? "" : "s"}`);
  if (estimatedRevenue != null) parts.push(formatCurrency(Number(estimatedRevenue)));
  if (convertedLeadId) parts.push("→ Lead");
  return parts.join(" · ");
}

const SCHEDULE_RELATION_ROW_COLUMNS =
  "id, first_name, last_name, partner_first_name, partner_last_name, email, event_type, event_date";

/**
 * The Leads and Clients a manual Schedule Item can be "Related to" — search,
 * not a preload. A venue with hundreds of relationships would make an
 * unbounded list unusable, so this is name/email search (the same
 * first/last/partner/email `.or(ilike...)` shape already established by
 * lib/leads/repository.ts and lib/clients/repository.ts's own search
 * filters — see lib/calendar/schedule-relation-search.ts for the tested
 * matching contract this query is written to satisfy), capped per group,
 * against the existing leads/clients tables rather than a new relationship
 * table: this codebase already anchors calendar-adjacent records straight at
 * leads/clients by FK (date_holds.lead_id, events.client_id,
 * requests.client_id), and an optional association does not justify a
 * parallel structure.
 */
export async function searchScheduleRelationOptions(query: string): Promise<ScheduleRelationOption[]> {
  const q = query.trim();
  if (!isSupabaseConfigured || !q) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const pattern = `%${q}%`;
  const orClause = `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},partner_first_name.ilike.${pattern},partner_last_name.ilike.${pattern}`;

  const [leadsRes, clientsRes] = await Promise.all([
    supabase.from("leads")
      .select(SCHEDULE_RELATION_ROW_COLUMNS)
      .eq("venue_id", venue.id)
      .not("status", "in", "(won,lost,cancelled)")
      .or(orClause)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("clients")
      .select(SCHEDULE_RELATION_ROW_COLUMNS)
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .or(orClause)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  return [
    ...((leadsRes.data ?? []) as unknown as ScheduleRelationRow[]).map((r) => toScheduleRelationOption("lead", r)),
    ...((clientsRes.data ?? []) as unknown as ScheduleRelationRow[]).map((r) => toScheduleRelationOption("client", r)),
  ];
}

/**
 * Resolves one Lead or Client into its display option — used to pre-populate
 * "Related to" (editing a Schedule Item that already has a leadId/clientId)
 * without re-searching or ever loading the full list.
 */
export async function getScheduleRelationOption(kind: "lead" | "client", id: string): Promise<ScheduleRelationOption | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const table = kind === "lead" ? "leads" : "clients";
  const { data } = await supabase.from(table)
    .select(SCHEDULE_RELATION_ROW_COLUMNS)
    .eq("venue_id", venue.id)
    .eq("id", id)
    .maybeSingle<ScheduleRelationRow>();
  return data ? toScheduleRelationOption(kind, data) : null;
}

export async function getCalendarData(
  year: number,
  month: number,
): Promise<CalendarData> {
  if (!isSupabaseConfigured) return { year, month, items: [] };
  const venue = await getCurrentVenue();
  if (!venue) return { year, month, items: [] };
  const supabase = await createClient();

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Venue Calendar Slice 1 — scheduled / reserved / blocked only.
  const [
    eventsRes, tourItems, holdsRes, blocksRes, scheduledTasksRes,
  ] = await Promise.all([
    // 1. Booked events
    supabase.from("events")
      .select("id, name, event_date, event_end_date, start_time, event_type, status, client_id, space_id, clients(first_name, last_name), venue_spaces(name)")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .lte("event_date", end)
      .or(`event_end_date.gte.${start},and(event_end_date.is.null,event_date.gte.${start})`),

    // 2. Venue tours — tour_appointments is the only Tour SoR on Calendar.
    //
    // Event → Tour conflict is operational-window overlap, enforced by
    // `_is_tour_slot_blocked` / slot generation — not by Calendar. Calendar
    // is a view and can show a Tour next to an Event on the same date when
    // their intervals do not overlap, or when the Tour was booked first.
    getTourCalendarEntries(supabase, venue.id, start, end, venue.timezone),

    // 3. Active date holds (Sprint 20). TR-B5: expires_at was never checked
    // here, so an expired hold kept showing (and blocking) indefinitely
    // until a human manually released it.
    supabase.from("date_holds")
      .select("id, title, hold_date, start_time, lead_id, leads(first_name, last_name)")
      .eq("venue_id", venue.id)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .gte("hold_date", start)
      .lte("hold_date", end),

    // 4. Calendar blocks — non-recurring blocks overlapping month, plus all active recurring blocks.
    // calendar_blocks has two FKs to leads (lead_id — "Related to" — and
    // converted_lead_id, a separate concept read as a raw id below, never
    // embedded), so the leads(...) embed must name which one it means or
    // PostgREST rejects the whole query as ambiguous (PGRST201).
    supabase.from("calendar_blocks")
      .select("id, title, type, reason, start_date, end_date, is_all_day, start_time, end_time, recurrence_rule, recurrence_ends_on, recurrence_interval, recurrence_count, lead_id, client_id, leads!calendar_blocks_lead_id_fkey(first_name, last_name), clients(first_name, last_name), event_type, client_name, guest_count, estimated_revenue, converted_lead_id, schedule_item_type_id, blocks_availability")
      .eq("venue_id", venue.id)
      .or(`and(start_date.lte.${end},end_date.gte.${start},recurrence_rule.eq.none),and(recurrence_rule.neq.none,or(recurrence_ends_on.is.null,recurrence_ends_on.gte.${start}))`),

    // 5. Scheduled Planning activities — only tasks with scheduled_date set
    // (presence). Due-date-only planning tasks stay off the venue Calendar.
    supabase.from("event_tasks")
      .select("id, title, event_id, scheduled_date, scheduled_start_time, location, status, assigned_to_staff_id, assignee:assigned_to_staff_id(full_name), events(name, client_id, clients(first_name, last_name))")
      .eq("venue_id", venue.id)
      .neq("status", "waived")
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end),
  ]);

  const items: CalendarItem[] = [];

  // Events — one item per protected day in the visible range (Calendar is a
  // view; occupancy still uses event_date through coalesce(event_end_date)).
  for (const e of (eventsRes.data ?? []) as any[]) {
    const cn = e.clients ? `${e.clients.first_name} ${e.clients.last_name}` : null;
    const dates = calendarDatesForProtectedEvent(e.event_date, e.event_end_date ?? null, start, end);
    for (const date of dates) {
      items.push({
        id: `event-${e.id}-${date}`,
        type: "event",
        date,
        title: cn ?? e.name,
        subtitle: [e.status === "complete" ? "Completed" : null, e.event_type ? eventTypeLabel(e.event_type) : null]
          .filter(Boolean)
          .join(" · ") || null,
        time: e.start_time?.slice(0, 5) ?? null,
        link: `/events/${e.id}`,
        eventId: e.id,
        clientId: e.client_id ?? null,
        spaceId: e.space_id ?? null,
        spaceName: e.venue_spaces?.name ?? null,
      });
    }
  }

  // Tours — already-built CalendarItems from tours' own projection
  items.push(...tourItems);

  const catalogLabelById = new Map<string, string>();
  const catalogIds = [...new Set(
    ((blocksRes.data ?? []) as { schedule_item_type_id?: string | null }[])
      .map((b) => b.schedule_item_type_id)
      .filter((id): id is string => !!id),
  )];
  if (catalogIds.length > 0) {
    const { data: catalogRows } = await supabase
      .from("venue_schedule_item_types")
      .select("id, label")
      .eq("venue_id", venue.id)
      .in("id", catalogIds);
    for (const row of (catalogRows ?? []) as { id: string; label: string }[]) {
      catalogLabelById.set(row.id, row.label);
    }
  }

  // Date holds
  for (const h of (holdsRes.data ?? []) as any[]) {
    const ln = h.leads ? `${h.leads.first_name} ${h.leads.last_name}` : null;
    items.push({
      id: `hold-${h.id}`,
      type: "date_hold",
      date: h.hold_date,
      title: h.title,
      subtitle: ln ? `Hold for ${ln}` : null,
      time: h.start_time?.slice(0, 5) ?? null,
      link: h.lead_id ? `/leads/${h.lead_id}` : "/calendar",
    });
  }

  // Calendar blocks — expand into individual day entries, handling recurrence.
  const seenBlockDates = new Set<string>();
  for (const b of (blocksRes.data ?? []) as any[]) {
    const duration = durationInDays(b.start_date, b.end_date);
    const { time: blockTime, endTime: blockEndTime } = displayScheduleItemTimes(
      Boolean(b.is_all_day),
      b.start_time,
      b.end_time,
    );

    const relatedLeadName = b.leads
      ? [b.leads.first_name, b.leads.last_name].filter(Boolean).join(" ")
      : null;
    const relatedClientName = b.clients
      ? [b.clients.first_name, b.clients.last_name].filter(Boolean).join(" ")
      : null;
    const relatedName = relatedLeadName ?? relatedClientName;
    const relatedHref = b.lead_id ? `/leads/${b.lead_id}` : b.client_id ? `/clients/${b.client_id}` : null;

    const occurrenceStarts = expandOccurrenceStarts(
      b.start_date,
      {
        rule: (b.recurrence_rule ?? "none") as RecurrenceRule,
        interval: b.recurrence_interval ?? 1,
        endsOn: b.recurrence_ends_on ?? null,
        count: b.recurrence_count ?? null,
      },
      start,
      end,
      duration,
    );

    for (const occStart of occurrenceStarts) {
      for (const dateStr of occurrenceDates(occStart, duration)) {
        const key = `${b.id}-${dateStr}`;
        if (dateStr < start || dateStr > end || seenBlockDates.has(key)) continue;
        seenBlockDates.add(key);

        let subtitle: string | null;
        if (b.type === "tour") {
          // Legacy manual Tour rows — do not look like tour_appointments.
          subtitle = [relatedName, "Manual schedule — not a booked tour"].filter(Boolean).join(" · ");
        } else if (b.type === "tasting") {
          subtitle = [relatedName, "Legacy schedule item"].filter(Boolean).join(" · ");
        } else if (b.type === "blocked_time" && b.reason) {
          subtitle = blockReasonLabel(b.reason);
        } else if (isBookingPlaceholder(b.type as ManualScheduleType)) {
          subtitle = bookingPlaceholderSubtitle(b.guest_count, b.estimated_revenue, b.converted_lead_id);
        } else {
          subtitle = relatedName;
        }

        items.push({
          id: `block-${key}`,
          type: "calendar_block",
          date: dateStr,
          title: b.title,
          subtitle,
          time: blockTime,
          endTime: blockEndTime,
          link: b.converted_lead_id
            ? `/leads/${b.converted_lead_id}`
            : relatedHref ?? "/calendar",
          rawId: b.id,
          manualType: b.type ?? "blocked_time",
          convertedLeadId: b.converted_lead_id ?? null,
          leadId: b.lead_id ?? null,
          clientId: b.client_id ?? null,
          relatedName,
          catalogLabel: b.schedule_item_type_id
            ? (catalogLabelById.get(b.schedule_item_type_id) ?? null)
            : null,
        });
      }
    }
  }

  // Scheduled Planning activities
  for (const t of (scheduledTasksRes.data ?? []) as any[]) {
    const cn = t.events?.clients ? `${t.events.clients.first_name} ${t.events.clients.last_name}` : t.events?.name ?? null;
    items.push({
      id: `planning-${t.id}`,
      type: "planning_activity",
      date: t.scheduled_date,
      title: t.title,
      subtitle: [cn, t.location].filter(Boolean).join(" — ") || null,
      time: t.scheduled_start_time?.slice(0, 5) ?? null,
      link: `/events/${t.event_id}#playbook`,
      eventId: t.event_id,
      clientId: t.events?.client_id ?? null,
      assignedToStaffId: t.assigned_to_staff_id ?? null,
      assignedToName: t.assignee?.full_name ?? null,
    });
  }

  // Sort by date then time
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time ?? "99:99";
    const tb = b.time ?? "99:99";
    return ta < tb ? -1 : 1;
  });

  return { year, month, items };
}
