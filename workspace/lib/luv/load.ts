import {
  actorFirstNameFrom,
  computeRelationshipInsights,
} from "@/lib/luv/insights";
import { getDismissedInsightIdsSync } from "@/lib/luv/dismissals";
import { buildDailyBriefing } from "@/lib/luv/briefing";
import { buildDraftBatch, buildDraftsForRelationship } from "@/lib/luv/drafts";
import { toOperationalWorkspaceData } from "@/lib/data/operational";
import { getData } from "@/lib/data/store";
import type { Relationship } from "@/lib/types";
import type { LuvBriefing, LuvDraft, LuvInsight } from "@/lib/luv/types";

export function loadLuvBriefing(actor: {
  id: string;
  name: string;
}): { briefing: LuvBriefing; drafts: LuvDraft[] } {
  // Daily briefing is operational-only — sandbox_demo / disposable must not
  // fabricate "overnight" business activity after CRM cleanup.
  const data = toOperationalWorkspaceData(getData());
  const briefing = buildDailyBriefing(data, actor);
  const drafts = buildDraftBatch(briefing.followUpInsights, data, actor.name);
  return { briefing, drafts };
}

export function loadLuvRelationshipAdvisor(
  relationship: Relationship,
  actor: { id: string; name: string },
): { insights: LuvInsight[]; drafts: LuvDraft[]; actorFirstName: string } {
  const data = getData();
  const dismissed = getDismissedInsightIdsSync(actor.id);
  const actorFirstName = actorFirstNameFrom(actor.name);
  const insights = computeRelationshipInsights(relationship, data, {
    dismissedIds: dismissed,
    actorFirstName,
    allRelationships: data.relationships,
  });
  const drafts = buildDraftsForRelationship(relationship, insights, actor.name);
  return { insights, drafts, actorFirstName };
}
