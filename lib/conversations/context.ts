/**
 * Relationship Context Panel (RC2, Milestone 1, upgraded in Milestone 4) —
 * "conversation as the relationship's paper folder, not just chat." A
 * read-only composed read alongside the thread: linked Requests + recent
 * activity. Attachments come from the already-loaded message list, not a
 * second fetch. No new tables — this is a query, not a system.
 *
 * recentActivity now sources from the full Activity Timeline
 * (lib/activity-timeline) — the audit-trail composition covering leads,
 * clients, events, payments, invoices, requests, contracts, timeline
 * submissions, guest counts, vendors, and Conversation activity (collapsed
 * to started/resumed markers) — capped to a handful for this sidebar. The
 * uncapped feed is the Activity tab this same read powers.
 */
import { isSupabaseConfigured } from "@/lib/env";
import { getRequests } from "@/lib/requests/service";
import { getActivityTimelineForLeadOrClient } from "@/lib/activity-timeline/service";
import type { Request } from "@/lib/requests/types";
import type { ActivityTimelineEvent } from "@/lib/activity-timeline/types";

export type RelationshipContext = {
  requests: Request[];
  recentActivity: ActivityTimelineEvent[];
};

const EMPTY: RelationshipContext = { requests: [], recentActivity: [] };
const RECENT_ACTIVITY_LIMIT = 8;

export async function getRelationshipContext(
  leadId: string | null,
  clientId: string | null,
): Promise<RelationshipContext> {
  if (!isSupabaseConfigured || (!leadId && !clientId)) return EMPTY;

  const [requests, timeline] = await Promise.all([
    clientId ? getRequests({ clientId }) : Promise.resolve([]),
    getActivityTimelineForLeadOrClient(leadId, clientId),
  ]);

  return {
    requests: requests.filter((r) => r.status !== "completed" && r.status !== "cancelled").slice(0, 5),
    recentActivity: timeline.slice(0, RECENT_ACTIVITY_LIMIT),
  };
}
