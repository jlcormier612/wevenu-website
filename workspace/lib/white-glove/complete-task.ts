/**
 * Complete a Relationship task and append timeline activity.
 * Prefers live shared store; falls back to Program 3 local overlay (seed mode).
 */

import {
  completeRelationshipTask,
  hasLiveRelationshipsSync,
  loadLiveStoreSync,
} from "@shared/relationships";

import { getTasks } from "@/lib/data/store";
import {
  appendLocalTimeline,
  ensureProgram3Data,
  newId,
  upsertLocalTask,
} from "@/lib/program3/store";
import { getActingMember } from "@/lib/program4/session";

export type CompleteTaskResult =
  | { ok: true; taskId: string; title: string; relationshipId: string }
  | { ok: false; error: string };

export async function completeTaskInWorkspace(
  taskId: string,
): Promise<CompleteTaskResult> {
  const id = taskId.trim();
  if (!id) return { ok: false, error: "taskId required" };

  await ensureProgram3Data();
  const existing = getTasks().find((t) => t.id === id);
  if (!existing) return { ok: false, error: "Task not found" };
  if (existing.status === "completed") {
    return { ok: false, error: "Task already completed" };
  }
  if (existing.status === "cancelled") {
    return { ok: false, error: "Task is cancelled" };
  }

  const actor = await getActingMember();
  const now = new Date().toISOString();

  const inLive =
    hasLiveRelationshipsSync() &&
    (loadLiveStoreSync().tasks ?? []).some((t) => t.id === id);

  if (inLive) {
    const result = await completeRelationshipTask(id, { actorId: actor.id, completedAt: now });
    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      taskId: id,
      title: result.task.title,
      relationshipId: result.task.relationshipId,
    };
  }

  await upsertLocalTask({
    id: existing.id,
    relationshipId: existing.relationshipId,
    title: existing.title,
    description: existing.description,
    ownerId: existing.ownerId,
    dueDate: existing.dueDate,
    priority: existing.priority,
    status: "completed",
    createdAt: existing.createdAt,
    completedAt: now,
    meta: existing.meta,
  });

  await appendLocalTimeline({
    id: newId("evt"),
    relationshipId: existing.relationshipId,
    type: "task_completed",
    title: `Task completed: ${existing.title}`,
    body: existing.description,
    occurredAt: now,
    actorId: actor.id,
    meta: {
      task_id: existing.id,
      checklist: existing.meta?.checklist ?? null,
    },
  });

  return {
    ok: true,
    taskId: id,
    title: existing.title,
    relationshipId: existing.relationshipId,
  };
}
