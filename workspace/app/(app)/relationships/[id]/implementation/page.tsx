import { notFound } from "next/navigation";

import { WhiteGloveImplementationPanel } from "@/components/relationships/white-glove-implementation-panel";
import { getRelationship, getTasks } from "@/lib/data/store";
import { loadLifecycleSettings } from "@/lib/lifecycle-settings";
import { actorCan, getActingMember } from "@/lib/program4/session";
import { ensureProgram4Data } from "@/lib/program4/store";
import { ensureWhiteGloveChecklistsInWorkspace } from "@/lib/white-glove/ensure-checklist";
import {
  WHITE_GLOVE_CHECKLIST_MARKER,
  WHITE_GLOVE_CHECKLIST_TITLES,
  whiteGloveLaunchReady,
  whiteGloveTimelineLabel,
} from "@shared/relationships";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const relationship = getRelationship(id);
  return {
    title: relationship
      ? `Implementation — ${relationship.venue.name}`
      : "White Glove Implementation",
  };
}

export default async function WhiteGloveImplementationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureProgram4Data();
  await ensureWhiteGloveChecklistsInWorkspace();

  const canView =
    (await actorCan("manage_onboarding")) ||
    (await actorCan("view_onboarding")) ||
    (await actorCan("manage_product_sync"));
  if (!canView) notFound();

  const relationship = getRelationship(id);
  if (!relationship) notFound();

  const actor = await getActingMember();
  const settings = await loadLifecycleSettings();
  const allTasks = getTasks({ relationshipId: id });
  const tasks = allTasks.filter(
    (t) =>
      t.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER ||
      (WHITE_GLOVE_CHECKLIST_TITLES as readonly string[]).includes(t.title),
  );
  const readiness = whiteGloveLaunchReady(id, tasks);
  const canLaunch =
    (await actorCan("manage_onboarding")) ||
    (await actorCan("manage_product_sync"));
  const canOverride =
    actor.role === "owner" || actor.role === "administrator";
  const canEdit = await actorCan("manage_onboarding");

  return (
    <WhiteGloveImplementationPanel
      relationshipId={id}
      venueName={relationship.venue.name}
      status={relationship.status}
      tasks={tasks}
      implementationNotes={relationship.implementationNotes ?? ""}
      assets={relationship.implementationAssets ?? {}}
      launchReady={readiness.ready}
      completedCount={readiness.completed}
      totalCount={readiness.total}
      missing={readiness.missing}
      canLaunch={canLaunch}
      canOverride={canOverride}
      canEdit={canEdit}
      timelineLabel={whiteGloveTimelineLabel(settings.whiteGlove)}
    />
  );
}
