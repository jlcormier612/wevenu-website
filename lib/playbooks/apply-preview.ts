/**
 * Planning Templates — Choose → Preview → Apply copy and grouping helpers.
 * Pure presentation logic; does not change apply/release engine behavior.
 */
import type { PlaybookKind, PlaybookMilestone, PlaybookTask } from "@/lib/playbooks/types";

export type ApplyPreviewMilestoneGroup = {
  milestoneId: string;
  milestoneName: string;
  taskTitles: string[];
};

/** Product language for the two checklist kinds at apply time. */
export function applyPreviewKindCopy(kind: PlaybookKind): {
  label: string;
  explanation: string;
  /** Short empty-state line on the apply row. */
  emptyState: string;
} {
  if (kind === "client") {
    return {
      label: "For your couple",
      explanation:
        "Tasks are prepared for this event and remain a draft until you're ready to release them to the couple.",
      emptyState: "No couple checklist applied yet",
    };
  }
  return {
    label: "For your team",
    explanation:
      "Tasks become active for your venue team immediately after applying.",
    emptyState: "No team checklist applied yet",
  };
}

/** Short isolation note — template vs this event's copy. */
export const APPLY_PREVIEW_ISOLATION_NOTE =
  "Applying this template creates a copy for this event. Changes you make later in your Library won't change this event's task list.";

/**
 * Group template tasks under milestones for a readable preview.
 * Tasks whose milestone is missing fall under "Other".
 */
export function groupTasksForApplyPreview(
  milestones: PlaybookMilestone[],
  tasks: PlaybookTask[],
): ApplyPreviewMilestoneGroup[] {
  const sortedMilestones = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const byMilestone = new Map<string, string[]>();

  for (const m of sortedMilestones) {
    byMilestone.set(m.id, []);
  }

  const orphanTitles: string[] = [];
  for (const t of sortedTasks) {
    const list = byMilestone.get(t.milestoneId);
    if (list) list.push(t.title);
    else orphanTitles.push(t.title);
  }

  const groups: ApplyPreviewMilestoneGroup[] = sortedMilestones
    .map((m) => ({
      milestoneId: m.id,
      milestoneName: m.name,
      taskTitles: byMilestone.get(m.id) ?? [],
    }))
    .filter((g) => g.taskTitles.length > 0);

  if (orphanTitles.length > 0) {
    groups.push({
      milestoneId: "__other__",
      milestoneName: "Other",
      taskTitles: orphanTitles,
    });
  }

  return groups;
}
