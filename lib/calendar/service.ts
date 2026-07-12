/**
 * Calendar application service (Sprint 17, extended through Calendar
 * Integration Phase 1, Phase 2, and Phase 3).
 *
 * getCalendarData() aggregates data from existing tables in parallel for one
 * venue-wide month — no new DB tables, and this function's own behavior is
 * unchanged by Phase 3 (see booking-schedule.ts for the new booking-scoped
 * lens, which reuses each feature's own service functions rather than
 * querying tables directly).
 * Returns a flat list of CalendarItems for the given month.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { CalendarData, CalendarItem } from "@/lib/calendar/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { eventTypeLabel } from "@/lib/leads/constants";
import { getTourCalendarEntries } from "@/lib/tours/service";

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
  const todayIso = new Date().toISOString().slice(0, 10);

  // Ten parallel queries across existing tables, plus tours' own projection
  const [
    eventsRes, tourItems, followUpsRes, paymentsRes, keyDatesRes, holdsRes, blocksRes, scheduledTasksRes,
    requestsRes, contractsRes, documentsRes,
  ] = await Promise.all([
    // 1. Booked events
    supabase.from("events")
      .select("id, name, event_date, start_time, event_type, status, client_id, space_id, clients(first_name, last_name), venue_spaces(name)")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .gte("event_date", start)
      .lte("event_date", end),

    // 2. Venue tours — tours' own calendar projection (TR-B4: this used to
    // read the legacy leads.tour_date field directly and silently never
    // reflected publicly-booked tours; tour_appointments is now the single
    // canonical source regardless of how the tour was scheduled).
    getTourCalendarEntries(supabase, venue.id, start, end),

    // 3. Follow-up dates (from leads)
    supabase.from("leads")
      .select("id, first_name, last_name, partner_first_name, follow_up_date, next_action_text, status")
      .eq("venue_id", venue.id)
      .not("follow_up_date", "is", null)
      .not("status", "in", "(won,lost,cancelled)")
      .gte("follow_up_date", start)
      .lte("follow_up_date", end),

    // 4. Payment due dates (pending + overdue)
    supabase.from("payment_line_items")
      .select("id, label, amount, due_date, schedule_id, payment_schedules(title, client_id, event_id, clients(first_name, last_name))")
      .eq("venue_id", venue.id)
      .in("status", ["pending", "overdue"])
      .not("due_date", "is", null)
      .gte("due_date", start)
      .lte("due_date", end),

    // 5. Client key dates (milestones)
    supabase.from("client_key_dates")
      .select("id, label, date, note, client_id, clients(first_name, last_name)")
      .eq("venue_id", venue.id)
      .gte("date", start)
      .lte("date", end),

    // 6. Active date holds (Sprint 20). TR-B5: expires_at was never checked
    // here, so an expired hold kept showing (and blocking) indefinitely
    // until a human manually released it.
    supabase.from("date_holds")
      .select("id, title, hold_date, start_time, lead_id, leads(first_name, last_name)")
      .eq("venue_id", venue.id)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .gte("hold_date", start)
      .lte("hold_date", end),

    // 7. Calendar blocks — non-recurring blocks overlapping month, plus all active recurring blocks
    supabase.from("calendar_blocks")
      .select("id, title, reason, start_date, end_date, is_all_day, start_time, end_time, recurrence_rule, recurrence_ends_on")
      .eq("venue_id", venue.id)
      .or(`and(start_date.lte.${end},end_date.gte.${start},recurrence_rule.eq.none),and(recurrence_rule.neq.none,or(recurrence_ends_on.is.null,recurrence_ends_on.gte.${start}))`),

    // 8. Scheduled Planning activities (Calendar Integration — Phase 1). Only
    // tasks a coordinator explicitly marked as "I show up somewhere for
    // this" (scheduled_date set) — plain due-date-only tasks are Planning's
    // own concern and are deliberately not surfaced here. Waived tasks are
    // excluded: a waived scheduled activity isn't happening.
    supabase.from("event_tasks")
      .select("id, title, event_id, scheduled_date, scheduled_start_time, location, status, assigned_to_staff_id, assignee:assigned_to_staff_id(full_name), events(name, client_id, clients(first_name, last_name))")
      .eq("venue_id", venue.id)
      .neq("status", "waived")
      .not("scheduled_date", "is", null)
      .gte("scheduled_date", start)
      .lte("scheduled_date", end),

    // 9. Requests — Due Date kind (Calendar Integration — Phase 2). Only
    // in-flight requests (excludes draft — not yet sent to the client;
    // completed/cancelled — no longer a live deadline). "Overdue" and
    // "submitted, awaiting review" are annotated on this same item rather
    // than queried as separate facts: Request has no dedicated overdue or
    // submitted-at column, so both are derived the same way Luv already
    // derives them (dueDate < today; status check) — reused, not reinvented.
    supabase.from("requests")
      .select("id, title, due_date, status, client_id, event_id, clients(first_name, last_name)")
      .eq("venue_id", venue.id)
      .not("status", "in", "(draft,completed,cancelled)")
      .not("due_date", "is", null)
      .gte("due_date", start)
      .lte("due_date", end),

    // 10. Contract expiration — Expiration kind, not Due Date (§2a): a lapsed
    // contract wasn't "incomplete," it's invalid. Note: expires_at exists on
    // every contract row but nothing in this codebase currently writes it —
    // this query is correct and future-proof, but will surface zero items
    // until Contracts itself starts populating the field (documented gap,
    // not fixed here — out of this phase's scope).
    supabase.from("contracts")
      .select("id, title, expires_at, status, client_id, event_id, clients(first_name, last_name)")
      .eq("venue_id", venue.id)
      .not("status", "in", "(signed,cancelled)")
      .not("expires_at", "is", null)
      .gte("expires_at", start)
      .lte("expires_at", end),

    // 11. Document expiration — Expiration kind (§2a), same shape as
    // Contracts. Only documents with a real workspace to link back into
    // (client or event) — a lead/vendor-scoped or unattached document has no
    // "owning workspace" for Calendar to navigate into (§8 Navigation).
    supabase.from("documents")
      .select("id, name, expires_at, client_id, event_id, clients(first_name, last_name), events(client_id, clients(first_name, last_name))")
      .eq("venue_id", venue.id)
      .not("expires_at", "is", null)
      .or("client_id.not.is.null,event_id.not.is.null")
      .gte("expires_at", start)
      .lte("expires_at", end),
  ]);

  const items: CalendarItem[] = [];

  // Events
  for (const e of (eventsRes.data ?? []) as any[]) {
    const cn = e.clients ? `${e.clients.first_name} ${e.clients.last_name}` : null;
    items.push({
      id: `event-${e.id}`,
      type: "event",
      date: e.event_date,
      title: cn ?? e.name,
      subtitle: e.event_type ? eventTypeLabel(e.event_type) : null,
      time: e.start_time?.slice(0, 5) ?? null,
      link: `/events/${e.id}`,
      eventId: e.id,
      clientId: e.client_id ?? null,
      spaceId: e.space_id ?? null,
      spaceName: e.venue_spaces?.name ?? null,
    });
  }

  // Tours — already-built CalendarItems from tours' own projection
  items.push(...tourItems);

  // Follow-ups
  for (const l of (followUpsRes.data ?? []) as any[]) {
    const name = [l.first_name, l.last_name].join(" ") +
      (l.partner_first_name ? ` & ${l.partner_first_name}` : "");
    items.push({
      id: `followup-${l.id}`,
      type: "follow_up",
      date: l.follow_up_date,
      title: `Follow-up — ${name}`,
      subtitle: l.next_action_text ?? null,
      time: null,
      link: `/leads/${l.id}`,
    });
  }

  // Payment due dates
  for (const p of (paymentsRes.data ?? []) as any[]) {
    const cn = p.payment_schedules?.clients
      ? `${p.payment_schedules.clients.first_name} ${p.payment_schedules.clients.last_name}`
      : p.payment_schedules?.title ?? null;
    const amt = p.amount != null
      ? ` — $${Number(p.amount).toLocaleString()}`
      : "";
    items.push({
      id: `payment-${p.id}`,
      type: "payment_due",
      date: p.due_date,
      title: `${p.label}${amt}`,
      subtitle: cn,
      time: null,
      link: `/payments/${p.schedule_id}`,
      eventId: p.payment_schedules?.event_id ?? null,
      clientId: p.payment_schedules?.client_id ?? null,
    });
  }

  // Key dates
  for (const k of (keyDatesRes.data ?? []) as any[]) {
    const cn = k.clients
      ? `${k.clients.first_name} ${k.clients.last_name}`
      : null;
    items.push({
      id: `keydate-${k.id}`,
      type: "key_date",
      date: k.date,
      title: k.label,
      subtitle: cn,
      time: null,
      link: `/clients/${k.client_id}`,
      clientId: k.client_id ?? null,
    });
  }

  // Date holds (Sprint 20)
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

  // Calendar blocks — expand into individual day entries, handling recurrence
  const seenBlockDates = new Set<string>();
  for (const b of (blocksRes.data ?? []) as any[]) {
    const rule: string = b.recurrence_rule ?? "none";
    const origStart = new Date(b.start_date + "T12:00:00");
    const origEnd   = new Date(b.end_date   + "T12:00:00");
    const durationMs = origEnd.getTime() - origStart.getTime();
    const recurrenceEndD = b.recurrence_ends_on ? new Date(b.recurrence_ends_on + "T23:59:59") : null;
    const monthStartD = new Date(start + "T00:00:00");
    const monthEndD   = new Date(end   + "T23:59:59");
    const blockTime   = b.is_all_day ? null : (b.start_time?.slice(0, 5) ?? null);

    const occurrenceStarts: Date[] = [];

    if (rule === "none") {
      occurrenceStarts.push(new Date(origStart));
    } else if (rule === "daily") {
      let cur = new Date(origStart);
      while (cur <= monthEndD && (!recurrenceEndD || cur <= recurrenceEndD)) {
        const occEnd = new Date(cur.getTime() + durationMs);
        if (occEnd >= monthStartD) occurrenceStarts.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else if (rule === "weekly") {
      let cur = new Date(origStart);
      while (cur <= monthEndD && (!recurrenceEndD || cur <= recurrenceEndD)) {
        const occEnd = new Date(cur.getTime() + durationMs);
        if (occEnd >= monthStartD) occurrenceStarts.push(new Date(cur));
        cur.setDate(cur.getDate() + 7);
      }
    } else if (rule === "annual") {
      for (let y = monthStartD.getFullYear() - 1; y <= monthEndD.getFullYear() + 1; y++) {
        const occStart = new Date(y, origStart.getMonth(), origStart.getDate(), 12);
        if (occStart < origStart) continue;
        if (recurrenceEndD && occStart > recurrenceEndD) continue;
        const occEnd = new Date(occStart.getTime() + durationMs);
        if (occEnd >= monthStartD && occStart <= monthEndD) occurrenceStarts.push(occStart);
      }
    }

    for (const occStart of occurrenceStarts) {
      const occEnd = new Date(occStart.getTime() + durationMs);
      let cursor = new Date(occStart);
      while (cursor <= occEnd) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const key = `${b.id}-${dateStr}`;
        if (dateStr >= start && dateStr <= end && !seenBlockDates.has(key)) {
          seenBlockDates.add(key);
          items.push({
            id: `block-${key}`,
            type: "calendar_block",
            date: dateStr,
            title: b.title,
            subtitle: b.reason,
            time: blockTime,
            link: "/calendar",
            rawId: b.id,
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  // Scheduled Planning activities (Calendar Integration — Phase 1). Calendar
  // never edits these — it links back into Planning, the same "reveal,
  // don't duplicate" pattern as every other item type here.
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

  // Requests — Due Date kind (Calendar Integration — Phase 2). Calendar
  // never edits these — it links back into the Request Center.
  for (const r of (requestsRes.data ?? []) as any[]) {
    const cn = r.clients ? `${r.clients.first_name} ${r.clients.last_name}` : null;
    const overdue = r.due_date < todayIso;
    const submitted = r.status === "submitted" || r.status === "reviewed";
    const state = overdue ? "Overdue" : submitted ? "Submitted — awaiting review" : null;
    items.push({
      id: `request-${r.id}`,
      type: "request_due",
      date: r.due_date,
      title: r.title,
      subtitle: [cn, state].filter(Boolean).join(" — ") || null,
      time: null,
      link: `/requests/${r.id}`,
      eventId: r.event_id ?? null,
      clientId: r.client_id ?? null,
    });
  }

  // Contract expiration — Expiration kind, not Due Date (§2a).
  for (const c of (contractsRes.data ?? []) as any[]) {
    const cn = c.clients ? `${c.clients.first_name} ${c.clients.last_name}` : null;
    items.push({
      id: `contract-${c.id}`,
      type: "contract_expiration",
      date: c.expires_at,
      title: `${c.title} expires`,
      subtitle: cn,
      time: null,
      link: `/contracts/${c.id}`,
      eventId: c.event_id ?? null,
      clientId: c.client_id ?? null,
    });
  }

  // Document expiration — Expiration kind (§2a), same shape as Contracts.
  for (const d of (documentsRes.data ?? []) as any[]) {
    const clientRow = d.clients ?? d.events?.clients;
    const cn = clientRow ? `${clientRow.first_name} ${clientRow.last_name}` : null;
    items.push({
      id: `document-${d.id}`,
      type: "document_expiration",
      date: d.expires_at,
      title: `${d.name} expires`,
      subtitle: cn,
      time: null,
      link: d.event_id ? `/events/${d.event_id}` : `/clients/${d.client_id}`,
      eventId: d.event_id ?? null,
      clientId: d.client_id ?? null,
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
