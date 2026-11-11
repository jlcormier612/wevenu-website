/**
 * Template-editor helpers for depends_on_option_ids authoring.
 * Runtime activation stays in lib/client-choices/conditional-groups.ts.
 */
import type {
  EventOrderTemplateGroup,
  EventOrderTemplateOption,
} from "@/lib/event-order-templates/types";

export type ParentOptionCandidate = {
  id: string;
  label: string;
  groupId: string;
  groupName: string;
};

/** Options from other groups on the same template (never the group being edited). */
export function parentOptionCandidates(
  groups: EventOrderTemplateGroup[],
  options: EventOrderTemplateOption[],
  excludeGroupId: string | null,
): ParentOptionCandidate[] {
  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const out: ParentOptionCandidate[] = [];
  for (const group of sortedGroups) {
    if (excludeGroupId && group.id === excludeGroupId) continue;
    const opts = options
      .filter((o) => o.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const opt of opts) {
      out.push({
        id: opt.id,
        label: opt.label,
        groupId: group.id,
        groupName: groupNameById.get(group.id) ?? group.name,
      });
    }
  }
  return out;
}

/** Keep only option ids that exist on the template and are not in the excluded group. */
export function sanitizeDependsOnOptionIds(
  requested: string[] | null | undefined,
  options: EventOrderTemplateOption[],
  excludeGroupId: string | null,
): string[] {
  const allowed = new Set(
    options
      .filter((o) => (excludeGroupId ? o.groupId !== excludeGroupId : true))
      .map((o) => o.id),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of requested ?? []) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Admin-facing summary. Empty deps = always shown.
 * Multiple parents use "or" — matches runtime (any selected parent activates).
 */
export function formatDependsOnSummary(
  dependsOnOptionIds: string[] | null | undefined,
  options: EventOrderTemplateOption[],
): string {
  const ids = (dependsOnOptionIds ?? []).filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  if (ids.length === 0) return "Always shown";
  const labelById = new Map(options.map((o) => [o.id, o.label]));
  const labels = ids.map((id) => labelById.get(id) ?? "Unknown option");
  if (labels.length === 1) return `Depends on: ${labels[0]}`;
  if (labels.length === 2) return `Depends on: ${labels[0]} or ${labels[1]}`;
  const head = labels.slice(0, -1).join(", ");
  const last = labels[labels.length - 1];
  return `Depends on: ${head}, or ${last}`;
}

export function isDependentGroup(
  group: Pick<EventOrderTemplateGroup, "dependsOnOptionIds">,
): boolean {
  return (group.dependsOnOptionIds?.length ?? 0) > 0;
}
