/**
 * Booking Schedule — Calendar Integration Phase 3.
 *
 * Calendar's booking-specific lens: every dated operational item for ONE
 * booking, chronological, read-only. This is not Timeline (the day-of
 * run-of-show) and not Planning (task management) — it reveals both,
 * alongside Requests, Contracts, Payments, and Documents, in one list,
 * without owning any of them. Every item still links back to its true
 * owning workspace, exactly like getCalendarData()'s month-wide items do.
 *
 * Unlike getCalendarData() (which queries tables directly), this file
 * reuses each feature's own service function — the strongest form of
 * "aggregate, don't duplicate": Payments' mark_overdue_payments RPC,
 * Request classification, and Contract/Document field access all run
 * through the exact same code path a coordinator visiting those features
 * directly would hit, not a second copy of their logic.
 */
import { getEvent } from "@/lib/events/service";
import { getEventTasks } from "@/lib/playbooks/service";
import { isScheduledActivity } from "@/lib/playbooks/constants";
import { getRequests } from "@/lib/requests/service";
import { getContracts } from "@/lib/contracts/service";
import { getPaymentSchedules, getPaymentSchedule } from "@/lib/payments/service";
import { getDocuments } from "@/lib/documents/service";
import type { CalendarItem } from "@/lib/calendar/types";

export type BookingScheduleData = {
  eventId: string;
  eventName: string;
  clientName: string | null;
  eventDate: string;
  items: CalendarItem[];
  /**
   * Capabilities Phase 3 was asked to combine but that own no date-bearing
   * field today — named honestly rather than invented, same discipline as
   * §2/§2a. Floor Plans and Seating have no scheduled concept at all
   * (already implicit in the wedding day itself); Communication has no
   * post-booking scheduled-follow-up field, only pre-booking lead
   * follow-ups.
   */
  gaps: string[];
};

const GAPS = [
  "Floor Plans — no scheduled/date concept exists; already implicit in the wedding day itself",
  "Seating — same reasoning as Floor Plans",
  "Communication — no post-booking scheduled-follow-up field exists yet (only pre-booking lead follow-ups)",
];

export async function getBookingScheduleData(eventId: string): Promise<BookingScheduleData | null> {
  const event = await getEvent(eventId);
  if (!event) return null;
  const clientId = event.clientId;
  const todayIso = new Date().toISOString().slice(0, 10);

  const [tasks, requests, allContracts, allSchedules, documents] = await Promise.all([
    getEventTasks(eventId),
    getRequests({ eventId }),
    getContracts(),
    getPaymentSchedules(),
    getDocuments("event", eventId),
  ]);

  const items: CalendarItem[] = [];

  // The wedding day itself.
  items.push({
    id: `event-${event.id}`,
    type: "event",
    date: event.eventDate,
    title: event.clientName ?? event.name,
    subtitle: "Wedding Day",
    time: event.startTime?.slice(0, 5) ?? null,
    link: `/events/${event.id}`,
    eventId: event.id,
    clientId,
  });

  // Timeline — no date of its own (§2 finding); every entry borrows the
  // event's own date, already embedded on the event via getEvent().
  for (const entry of event.timeline) {
    items.push({
      id: `timeline-${entry.id}`,
      type: "timeline_entry",
      date: event.eventDate,
      title: entry.title,
      subtitle: null,
      time: entry.entryTime,
      link: `/events/${event.id}#timeline`,
      eventId: event.id,
      clientId,
    });
  }

  // Planning — both Due Date and Scheduled Activity tasks appear here,
  // unlike Month view (which only ever surfaces scheduled activities). A
  // booking-specific lens is exactly the place "all operational work for
  // this wedding" belongs; Month view's own scope is untouched by this.
  for (const task of tasks) {
    if (task.status === "waived") continue;
    if (isScheduledActivity(task)) {
      items.push({
        id: `planning-activity-${task.id}`,
        type: "planning_activity",
        date: task.scheduledDate!,
        title: task.title,
        subtitle: task.location,
        time: task.scheduledStartTime?.slice(0, 5) ?? null,
        link: `/events/${event.id}#playbook`,
        eventId: event.id,
        clientId,
      });
    } else {
      const overdue = task.status === "overdue";
      items.push({
        id: `planning-task-${task.id}`,
        type: "planning_task",
        date: task.dueDate,
        title: task.title,
        subtitle: overdue ? "Overdue" : task.status === "complete" ? "Complete" : null,
        time: null,
        link: `/events/${event.id}#playbook`,
        eventId: event.id,
        clientId,
      });
    }
  }

  // Requests — reuses getRequests({ eventId }), the same filtered read
  // path Requests' own UI uses; classification matches §2's request_due
  // item exactly (dueDate < today; submitted/reviewed).
  for (const r of requests) {
    if (r.status === "draft" || r.status === "completed" || r.status === "cancelled") continue;
    if (!r.dueDate) continue;
    const overdue = r.dueDate < todayIso;
    const submitted = r.status === "submitted" || r.status === "reviewed";
    items.push({
      id: `request-${r.id}`,
      type: "request_due",
      date: r.dueDate,
      title: r.title,
      subtitle: overdue ? "Overdue" : submitted ? "Submitted — awaiting review" : null,
      time: null,
      link: `/requests/${r.id}`,
      eventId: r.eventId,
      clientId: r.clientId,
    });
  }

  // Contracts — getContracts() has no filter param, so this booking's
  // contracts are selected client-side by the same clientId/eventId fields
  // §2's contract_expiration item already reads.
  const eventContracts = allContracts.filter((c) => c.eventId === eventId || c.clientId === clientId);
  for (const c of eventContracts) {
    if (!c.expiresAt) continue;
    if (c.status === "signed" || c.status === "cancelled") continue;
    items.push({
      id: `contract-${c.id}`,
      type: "contract_expiration",
      date: c.expiresAt,
      title: `${c.title} expires`,
      subtitle: null,
      time: null,
      link: `/contracts/${c.id}`,
      eventId: c.eventId,
      clientId: c.clientId,
    });
  }

  // Payments — getPaymentSchedules()/getPaymentSchedule() both call the
  // real mark_overdue_payments RPC before returning, unlike Month view's
  // payment_due query (which reads payment_line_items directly and can go
  // stale between Payments page visits — documented in this phase's
  // report, a pre-existing characteristic this phase doesn't change).
  const eventSchedules = allSchedules.filter((s) => s.eventId === eventId || s.clientId === clientId);
  const scheduleDetails = await Promise.all(eventSchedules.map((s) => getPaymentSchedule(s.id)));
  for (const detail of scheduleDetails) {
    if (!detail) continue;
    for (const line of detail.lineItems) {
      if (!line.dueDate) continue;
      if (line.status === "cancelled" || line.status === "paid" || line.status === "refunded") continue;
      items.push({
        id: `payment-${line.id}`,
        type: "payment_due",
        date: line.dueDate,
        title: `${line.label} — $${Number(line.amount).toLocaleString()}`,
        subtitle: line.status === "overdue" ? "Overdue" : null,
        time: null,
        link: `/payments/${line.scheduleId}`,
        eventId: detail.eventId,
        clientId: detail.clientId,
      });
    }
  }

  // Documents — getDocuments("event", eventId) is already exactly scoped.
  for (const doc of documents) {
    if (!doc.expiresAt) continue;
    items.push({
      id: `document-${doc.id}`,
      type: "document_expiration",
      date: doc.expiresAt,
      title: `${doc.name} expires`,
      subtitle: null,
      time: null,
      link: `/events/${eventId}#documents`,
      eventId,
      clientId,
    });
  }

  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time ?? "99:99";
    const tb = b.time ?? "99:99";
    return ta < tb ? -1 : 1;
  });

  return {
    eventId: event.id,
    eventName: event.name,
    clientName: event.clientName,
    eventDate: event.eventDate,
    items,
    gaps: GAPS,
  };
}
