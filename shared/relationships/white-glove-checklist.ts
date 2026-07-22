/**
 * Project 6 — White Glove Implementation Checklist.
 *
 * When onboardingType === white_glove, ensure these eight Tasks exist on the
 * Relationship (idempotent by title + checklist marker). Default owner: Eli (tm_eli).
 */

import { randomUUID } from "crypto";

import { withLiveStore } from "./store";
import type { LiveRelationshipStore, RelationshipTask, TaskPriority } from "./types";

/** Canonical Implementation Checklist titles (order = sortOrder). */
export const WHITE_GLOVE_CHECKLIST_TITLES = [
  "Venue branding",
  "Packages",
  "Contracts",
  "Questionnaires",
  "Email templates",
  "Website review",
  "Launch review",
  "Go Live",
] as const;

export type WhiteGloveChecklistTitle = (typeof WHITE_GLOVE_CHECKLIST_TITLES)[number];

/** Program 4 Implementation teammate (Eli Torres). */
export const WHITE_GLOVE_CHECKLIST_OWNER_ID = "tm_eli";

export const WHITE_GLOVE_CHECKLIST_MARKER = "white_glove_implementation";

const TITLE_PRIORITY: Partial<Record<WhiteGloveChecklistTitle, TaskPriority>> = {
  "Launch review": "high",
  "Go Live": "high",
};

function shortId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function dueDateForIndex(createdAt: string, index: number): string {
  const d = new Date(createdAt);
  d.setUTCDate(d.getUTCDate() + 3 + index * 3);
  return d.toISOString().slice(0, 10);
}

function isChecklistTask(task: RelationshipTask): boolean {
  if (task.meta?.checklist === WHITE_GLOVE_CHECKLIST_MARKER) return true;
  return (WHITE_GLOVE_CHECKLIST_TITLES as readonly string[]).includes(task.title);
}

/**
 * Idempotent: adds any missing checklist titles for the relationship.
 * Mutates `store` in place (caller holds the lock via withLiveStore / mutate).
 */
export function ensureWhiteGloveChecklistInStore(
  store: LiveRelationshipStore,
  relationshipId: string,
  opts?: { ownerId?: string; now?: string; actorId?: string },
): { created: RelationshipTask[]; alreadyComplete: boolean } {
  if (!store.tasks) store.tasks = [];

  const now = opts?.now ?? new Date().toISOString();
  const ownerId = opts?.ownerId?.trim() || WHITE_GLOVE_CHECKLIST_OWNER_ID;
  const existing = store.tasks.filter(
    (t) => t.relationshipId === relationshipId && isChecklistTask(t),
  );
  const existingTitles = new Set(existing.map((t) => t.title));

  const created: RelationshipTask[] = [];
  for (let i = 0; i < WHITE_GLOVE_CHECKLIST_TITLES.length; i++) {
    const title = WHITE_GLOVE_CHECKLIST_TITLES[i]!;
    if (existingTitles.has(title)) continue;

    const task: RelationshipTask = {
      id: shortId("task"),
      relationshipId,
      title,
      description: `White Glove implementation — ${title}`,
      ownerId,
      dueDate: dueDateForIndex(now, i),
      priority: TITLE_PRIORITY[title] ?? "medium",
      status: "open",
      createdAt: now,
      meta: {
        checklist: WHITE_GLOVE_CHECKLIST_MARKER,
        sort_order: i + 1,
      },
    };
    store.tasks.push(task);
    created.push(task);
  }

  if (created.length > 0) {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId,
      type: "onboarding_milestone",
      title: "Implementation Checklist created",
      body: `${created.length} White Glove implementation task${created.length === 1 ? "" : "s"} assigned.`,
      occurredAt: now,
      actorId: opts?.actorId,
      meta: {
        checklist: WHITE_GLOVE_CHECKLIST_MARKER,
        task_count: created.length,
        owner_id: ownerId,
      },
    });
    if (relationship) {
      relationship.updatedAt = now;
      relationship.lastContactAt = now;
      if (!relationship.nextMilestone) {
        relationship.nextMilestone = "Venue branding";
      }
    }
  }

  const allChecklist = store.tasks.filter(
    (t) => t.relationshipId === relationshipId && isChecklistTask(t),
  );
  const alreadyComplete =
    allChecklist.length >= WHITE_GLOVE_CHECKLIST_TITLES.length && created.length === 0;

  return { created, alreadyComplete };
}

/** Locked write: ensure checklist for one relationship. No-op if relationship missing. */
export async function ensureWhiteGloveChecklist(
  relationshipId: string,
  opts?: { ownerId?: string; actorId?: string },
): Promise<{ created: RelationshipTask[]; alreadyComplete: boolean } | null> {
  const id = relationshipId.trim();
  if (!id) return null;

  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === id);
    if (!relationship) return null;
    if (relationship.onboardingType !== "white_glove") {
      return { created: [] as RelationshipTask[], alreadyComplete: false };
    }
    return ensureWhiteGloveChecklistInStore(store, id, opts);
  });
  return result;
}

/**
 * Backfill every live White Glove relationship missing checklist tasks.
 * Safe to call from workspace page loads (idempotent).
 */
export async function ensureWhiteGloveChecklistsForLiveStore(opts?: {
  ownerId?: string;
}): Promise<{ relationshipsTouched: number; tasksCreated: number }> {
  const { result } = await withLiveStore((store) => {
    let relationshipsTouched = 0;
    let tasksCreated = 0;
    for (const relationship of store.relationships) {
      if (relationship.onboardingType !== "white_glove") continue;
      const { created } = ensureWhiteGloveChecklistInStore(store, relationship.id, {
        ownerId: opts?.ownerId,
      });
      if (created.length > 0) {
        relationshipsTouched += 1;
        tasksCreated += created.length;
      }
    }
    return { relationshipsTouched, tasksCreated };
  });
  return result;
}

export function isWhiteGloveChecklistTitle(title: string): boolean {
  return (WHITE_GLOVE_CHECKLIST_TITLES as readonly string[]).includes(title);
}
