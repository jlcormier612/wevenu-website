/**
 * Relationship Context Panel (RC2, Milestone 1) — "conversation as the
 * relationship's paper folder, not just chat." A lightweight, read-only
 * composed read alongside the thread: linked Requests + recent activity.
 * Attachments come from the already-loaded message list, not a second
 * fetch. No new tables — this is a query, not a system.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { getRequests } from "@/lib/requests/service";
import type { Request } from "@/lib/requests/types";

export type RelationshipActivityItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type RelationshipContext = {
  requests: Request[];
  recentActivity: RelationshipActivityItem[];
};

const EMPTY: RelationshipContext = { requests: [], recentActivity: [] };

export async function getRelationshipContext(
  leadId: string | null,
  clientId: string | null,
): Promise<RelationshipContext> {
  if (!isSupabaseConfigured || (!leadId && !clientId)) return EMPTY;
  const venue = await getCurrentVenue();
  if (!venue) return EMPTY;
  const supabase = await createClient();

  const [requests, activityRows] = await Promise.all([
    clientId ? getRequests({ clientId }) : Promise.resolve([]),
    clientId
      ? supabase.from("client_activities").select("id, type, title, description, created_at")
          .eq("venue_id", venue.id).eq("client_id", clientId)
          .order("created_at", { ascending: false }).limit(5)
      : leadId
      ? supabase.from("lead_activities").select("id, type, title, description, created_at")
          .eq("venue_id", venue.id).eq("lead_id", leadId)
          .order("created_at", { ascending: false }).limit(5)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  type ActivityRow = { id: string; type: string; title: string; description: string | null; created_at: string };
  const rows = ("data" in activityRows ? activityRows.data : []) as ActivityRow[] | null;

  return {
    requests: requests.filter((r) => r.status !== "completed" && r.status !== "cancelled").slice(0, 5),
    recentActivity: (rows ?? []).map((r) => ({
      id: r.id, type: r.type, title: r.title, description: r.description, createdAt: r.created_at,
    })),
  };
}
