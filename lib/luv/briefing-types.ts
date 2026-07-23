/**
 * Luv Success Guide §3.1 — the Daily Briefing (2026-07-22). Structured
 * data only, no rendering/channel-specific formatting — every consumer
 * (Dashboard card today; a future chat surface, email digest, or
 * notification) formats this same result for its own medium.
 * docs/luv-platform-intelligence-architecture.md §4 is the information
 * architecture this implements.
 */

export type BriefingItem = {
  id: string;
  eventId: string | null;
  eventName: string | null;
  /** ISO "YYYY-MM-DD", used for the date-proximity sort — the doc's own tiebreaker after status priority. */
  eventDate: string | null;
  label: string;
  detail: string;
  link: string;
};

export type LuvBriefing = {
  /** §4 item 1 — every needs_attention-status Event Readiness section, venue-wide, plus overdue Requests. Sorted by event-date proximity. */
  needsAttentionNow: BriefingItem[];
  /** §4 item 2 — events this week, tours this week, holds expiring this week. */
  comingUpThisWeek: BriefingItem[];
  /** §4 item 3 — celebrations that fired since the venue last viewed the briefing. */
  resolvedSinceLastLooked: BriefingItem[];
  /** §4 item 4 — everything else worth knowing, not urgent enough for #1. */
  informational: BriefingItem[];
  generatedAt: string;
};
