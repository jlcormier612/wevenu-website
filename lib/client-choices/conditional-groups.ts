/**
 * Parent → child conditional choice groups.
 * A group with dependsOnOptionIds is active only while at least one listed
 * parent option is selected. Empty dependsOnOptionIds = always active.
 */
import type {
  ChoicesAnswers,
  ChoicesDefinition,
  ChoicesDefinitionGroup,
} from "@/lib/client-choices/types";

/** All option ids currently selected across every group answer. */
export function selectedOptionIds(answers: ChoicesAnswers | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const answer of Object.values(answers ?? {})) {
    for (const id of answer?.optionIds ?? []) {
      if (typeof id === "string" && id.length > 0) out.add(id);
    }
  }
  return out;
}

export function groupDependsOnOptionIds(
  group: Pick<ChoicesDefinitionGroup, "dependsOnOptionIds">,
): string[] {
  const raw = group.dependsOnOptionIds;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** True when the group has no parent gate, or a parent option is selected. */
export function isChoiceGroupActive(
  group: Pick<ChoicesDefinitionGroup, "dependsOnOptionIds">,
  answers: ChoicesAnswers | null | undefined,
): boolean {
  const deps = groupDependsOnOptionIds(group);
  if (deps.length === 0) return true;
  const selected = selectedOptionIds(answers);
  return deps.some((id) => selected.has(id));
}

/** Root + nested ordering: parents first; children immediately after their parent group. */
export function orderedVisibleChoiceGroups(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers | null | undefined,
): ChoicesDefinitionGroup[] {
  const groups = definition.groups.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const active = groups.filter((g) => isChoiceGroupActive(g, answers));
  const byId = new Map(active.map((g) => [g.id, g]));
  const childrenByParentOption = new Map<string, ChoicesDefinitionGroup[]>();
  const roots: ChoicesDefinitionGroup[] = [];

  for (const group of active) {
    const deps = groupDependsOnOptionIds(group);
    if (deps.length === 0) {
      roots.push(group);
      continue;
    }
    // Nest under the first matching selected parent option's owning group.
    const selected = selectedOptionIds(answers);
    const parentOptionId = deps.find((id) => selected.has(id));
    const parentOption = parentOptionId
      ? definition.options.find((o) => o.id === parentOptionId)
      : undefined;
    const parentGroup = parentOption ? byId.get(parentOption.groupId) : undefined;
    if (parentGroup) {
      const list = childrenByParentOption.get(parentGroup.id) ?? [];
      list.push(group);
      childrenByParentOption.set(parentGroup.id, list);
    } else {
      roots.push(group);
    }
  }

  const out: ChoicesDefinitionGroup[] = [];
  const visit = (group: ChoicesDefinitionGroup) => {
    out.push(group);
    const children = (childrenByParentOption.get(group.id) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const child of children) visit(child);
  };
  for (const root of roots) visit(root);
  return out;
}

/**
 * Drop answers for inactive dependent groups so stale children are not
 * billable, submitted, or treated as required.
 */
export function reconcileAnswersForDependencies(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers | null | undefined,
): ChoicesAnswers {
  const safe = answers ?? {};
  const next: ChoicesAnswers = {};
  for (const group of definition.groups) {
    const answer = safe[group.id];
    if (!answer) continue;
    if (!isChoiceGroupActive(group, safe)) continue;
    next[group.id] = answer;
  }
  // Second pass: after clearing inactive, parent answers alone remain; children
  // that became inactive because we dropped a sibling are already excluded.
  // Re-evaluate against `next` so nested chains stay consistent.
  const reconciled: ChoicesAnswers = {};
  for (const group of definition.groups) {
    const answer = next[group.id];
    if (!answer) continue;
    if (!isChoiceGroupActive(group, next)) continue;
    reconciled[group.id] = answer;
  }
  return reconciled;
}

/** Option ids belonging to inactive groups — must not become EO lines. */
export function inactiveAnsweredOptionIds(
  definition: ChoicesDefinition,
  answers: ChoicesAnswers | null | undefined,
): string[] {
  const safe = answers ?? {};
  const out: string[] = [];
  for (const group of definition.groups) {
    if (isChoiceGroupActive(group, safe)) continue;
    for (const id of safe[group.id]?.optionIds ?? []) out.push(id);
  }
  return out;
}
