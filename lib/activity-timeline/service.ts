import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/activity-timeline/repository";
import type { ActivityTimelineEvent } from "@/lib/activity-timeline/types";

export async function getActivityTimelineForRelationship(relationshipId: string): Promise<ActivityTimelineEvent[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  return repo.getRelationshipActivityTimeline(supabase, relationshipId);
}

/** Convenience for callers (Lead/Client detail, Relationship Context Panel) that only know leadId/clientId, matching lib/conversations/context.ts's existing calling convention. */
export async function getActivityTimelineForLeadOrClient(
  leadId: string | null,
  clientId: string | null,
): Promise<ActivityTimelineEvent[]> {
  if (!isSupabaseConfigured || (!leadId && !clientId)) return [];
  const supabase = await createClient();

  let relationshipId: string | null = null;
  if (clientId) {
    const { data } = await supabase.from("clients").select("relationship_id").eq("id", clientId).maybeSingle<{ relationship_id: string | null }>();
    relationshipId = data?.relationship_id ?? null;
  } else if (leadId) {
    const { data } = await supabase.from("leads").select("relationship_id").eq("id", leadId).maybeSingle<{ relationship_id: string | null }>();
    relationshipId = data?.relationship_id ?? null;
  }
  if (!relationshipId) return [];
  return repo.getRelationshipActivityTimeline(supabase, relationshipId);
}
