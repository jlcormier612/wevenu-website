/**
 * Project 6 — ensure White Glove Implementation Checklist tasks exist.
 * Live store: shared helper. Seed-only venues: Program 3 local tasks.
 */

import {
  ensureWhiteGloveChecklistsForLiveStore,
  hasLiveRelationshipsSync,
  WHITE_GLOVE_CHECKLIST_MARKER,
  WHITE_GLOVE_CHECKLIST_OWNER_ID,
  WHITE_GLOVE_CHECKLIST_TITLES,
} from "@shared/relationships";

import { getTasks, getWhiteGloveRelationships } from "@/lib/data/store";
import {
  appendLocalTask,
  appendLocalTimeline,
  ensureProgram3Data,
  newId,
} from "@/lib/program3/store";

function dueDateForIndex(createdAt: string, index: number): string {
  const d = new Date(createdAt);
  d.setUTCDate(d.getUTCDate() + 3 + index * 3);
  return d.toISOString().slice(0, 10);
}

/** Idempotent backfill for seed-mode White Glove venues (no live store row). */
async function ensureSeedWhiteGloveChecklists(): Promise<number> {
  const whiteGlove = getWhiteGloveRelationships();
  const now = new Date().toISOString();
  let created = 0;

  for (const relationship of whiteGlove) {
    const existing = getTasks({ relationshipId: relationship.id });
    const titles = new Set(existing.map((t) => t.title));
    const missing = WHITE_GLOVE_CHECKLIST_TITLES.filter((title) => !titles.has(title));
    if (missing.length === 0) continue;

    for (let i = 0; i < WHITE_GLOVE_CHECKLIST_TITLES.length; i++) {
      const title = WHITE_GLOVE_CHECKLIST_TITLES[i]!;
      if (titles.has(title)) continue;
      await appendLocalTask({
        id: newId("task"),
        relationshipId: relationship.id,
        title,
        description: `White Glove implementation — ${title}`,
        ownerId: WHITE_GLOVE_CHECKLIST_OWNER_ID,
        dueDate: dueDateForIndex(now, i),
        priority: title === "Go Live" || title === "Launch review" ? "high" : "medium",
        status: "open",
        createdAt: now,
        meta: {
          checklist: WHITE_GLOVE_CHECKLIST_MARKER,
          sort_order: i + 1,
        },
      });
      created += 1;
    }

    await appendLocalTimeline({
      id: newId("evt"),
      relationshipId: relationship.id,
      type: "onboarding_milestone",
      title: "Implementation Checklist created",
      body: `${missing.length} White Glove implementation task${missing.length === 1 ? "" : "s"} assigned.`,
      occurredAt: now,
      meta: {
        checklist: WHITE_GLOVE_CHECKLIST_MARKER,
        task_count: missing.length,
        owner_id: WHITE_GLOVE_CHECKLIST_OWNER_ID,
      },
    });
  }

  return created;
}

/**
 * Call from White Glove / Tasks / Relationship pages.
 * Live relationships: shared store. Seed fallback: local tasks.
 */
export async function ensureWhiteGloveChecklistsInWorkspace(): Promise<void> {
  await ensureProgram3Data();

  if (hasLiveRelationshipsSync()) {
    await ensureWhiteGloveChecklistsForLiveStore();
    return;
  }

  await ensureSeedWhiteGloveChecklists();
}
