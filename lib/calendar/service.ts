/**
 * Calendar application service (Sprint 17).
 *
 * Aggregates data from five existing tables in parallel — no new DB tables.
 * Returns a flat list of CalendarItems for the given month.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { CalendarData, CalendarItem } from "@/lib/calendar/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { eventTypeLabel } from "@/lib/leads/constants";

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

  // Five parallel queries across existing tables
  const [eventsRes, toursRes, followUpsRes, paymentsRes, keyDatesRes] = await Promise.all([
    // 1. Booked events
    supabase.from("events")
      .select("id, name, event_date, start_time, event_type, status, client_id, clients(first_name, last_name)")
      .eq("venue_id", venue.id)
      .neq("status", "cancelled")
      .gte("event_date", start)
      .lte("event_date", end),

    // 2. Venue tours (from leads)
    supabase.from("leads")
      .select("id, first_name, last_name, partner_first_name, tour_date, tour_time, event_type")
      .eq("venue_id", venue.id)
      .not("tour_date", "is", null)
      .eq("tour_completed", false)
      .gte("tour_date", start)
      .lte("tour_date", end),

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
      .select("id, label, amount, due_date, schedule_id, payment_schedules(title, clients(first_name, last_name))")
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
    });
  }

  // Tours
  for (const l of (toursRes.data ?? []) as any[]) {
    const name = [l.first_name, l.last_name].join(" ") +
      (l.partner_first_name ? ` & ${l.partner_first_name}` : "");
    items.push({
      id: `tour-${l.id}`,
      type: "tour",
      date: l.tour_date,
      title: `Venue Tour — ${name}`,
      subtitle: l.event_type ? eventTypeLabel(l.event_type) : null,
      time: l.tour_time?.slice(0, 5) ?? null,
      link: `/leads/${l.id}`,
    });
  }

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
