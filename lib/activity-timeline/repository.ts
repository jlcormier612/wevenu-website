import { createClient } from "@/integrations/supabase/server";
import type { ActivityTimelineEvent } from "@/lib/activity-timeline/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type Row = {
  source: ActivityTimelineEvent["source"];
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
};

export async function getRelationshipActivityTimeline(
  client: DbClient,
  relationshipId: string,
): Promise<ActivityTimelineEvent[]> {
  const { data, error } = await client.rpc("get_relationship_activity_timeline", {
    p_relationship_id: relationshipId,
  });
  if (error) throw error;
  if (!data || "error" in data) return [];
  return ((data.events ?? []) as Row[]).map((r) => ({
    source: r.source, type: r.type, title: r.title, description: r.description, occurredAt: r.occurredAt,
  }));
}
