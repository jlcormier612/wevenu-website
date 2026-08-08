import { getVendorEvents } from "@/lib/vendor-events/service";
import { getVendorTimelineAcrossEvents } from "@/lib/vendor-events/service";
import { getVendorTasks } from "@/lib/vendor-tasks/service";
import { getVendorConversationInbox } from "@/lib/conversations/service";
import type { VendorEventListItem } from "@/lib/vendors/types";
import type { VendorPersonalTask } from "@/lib/vendors/types";
import type { VendorConversationSummary } from "@/lib/conversations/types";
import type { VendorTimelineByEvent } from "@/lib/vendor-portal/types";

export type VendorHomeData = {
  eventsToday: VendorEventListItem[];
  eventsThisWeek: VendorEventListItem[];
  // The vendor's full cross-venue event list — the venue-first Dashboard
  // hero (VendorVenueHero) filters this down to the active venue's own
  // upcoming-events count and next event, rather than re-fetching.
  allEvents: VendorEventListItem[];
  unreadConversations: VendorConversationSummary[];
  tasksDue: VendorPersonalTask[];
  nextTimeline: VendorTimelineByEvent[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function weekFromNowIso(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Vendor Workspace Realignment, Phase 4 (2026-07-22) — Home answers: what
 * events require me today, what messages need a reply, what tasks are due,
 * and what's next on my schedule. No CRM metrics, no marketplace analytics
 * — replaces the old business-dashboard aggregation entirely. Every field
 * here is read from the same sources the rest of the portal already reads
 * (events, conversations, tasks, timeline) — this is a synthesis, not a
 * new data source.
 */
export async function getVendorHomeData(vendorId: string): Promise<VendorHomeData> {
  const [events, inbox, tasks, timeline] = await Promise.all([
    getVendorEvents(),
    getVendorConversationInbox(),
    getVendorTasks(vendorId, { status: "pending" }),
    getVendorTimelineAcrossEvents(),
  ]);

  const today = todayIso();
  const week = weekFromNowIso();

  const eventsToday = events.filter((e) => e.eventDate === today);
  const eventsThisWeek = events.filter((e) => e.isUpcoming && e.eventDate && e.eventDate > today && e.eventDate <= week);

  const unreadConversations = inbox.conversations.filter((c) => c.contactUnread > 0);

  // Orphan personal tasks (no event_id) stay in DB but are hidden from UI.
  const tasksDue = tasks
    .filter((t) => t.eventId && t.dueDate && t.dueDate <= week)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  // "What's changed on the timeline" — no per-vendor read/seen tracking
  // exists on timeline_entries today, so this surfaces the practical
  // equivalent: the nearest upcoming items a vendor with an event today or
  // this week actually needs to see, not a true diff.
  const soonEventIds = new Set([...eventsToday, ...eventsThisWeek].map((e) => e.eventId));
  const nextTimeline = timeline.filter((t) => soonEventIds.has(t.eventId) && t.entries.length > 0);

  return { eventsToday, eventsThisWeek, allEvents: events, unreadConversations, tasksDue, nextTimeline };
}
