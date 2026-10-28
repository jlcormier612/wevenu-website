/**
 * Offerings catalog hierarchy helpers — major choices vs associated items.
 * One nesting level. An item may belong under multiple majors (M:N).
 * Existing flat offerings (no parents) remain valid.
 */

export type OfferingHierarchyFields = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  /** Preferred: zero or more major parents. */
  parentOfferingIds?: string[];
  /** Legacy single parent; used when parentOfferingIds is absent. */
  parentOfferingId?: string | null;
  isArchived?: boolean;
};

export type OfferingRole = "major" | "item" | "standalone";

/** Normalized parent id list for an offering. */
export function parentIdsOf<T extends OfferingHierarchyFields>(offering: T): string[] {
  // Explicit array (including empty) wins so cleared associations are not revived from denorm FK.
  if (Array.isArray(offering.parentOfferingIds)) {
    return [...new Set(offering.parentOfferingIds.filter(Boolean))];
  }
  if (offering.parentOfferingId) return [offering.parentOfferingId];
  return [];
}

export function hasParents<T extends OfferingHierarchyFields>(offering: T): boolean {
  return parentIdsOf(offering).length > 0;
}

/** Top-level rows that have at least one non-archived child. */
export function majorOfferingIds<T extends OfferingHierarchyFields>(
  offerings: T[],
): Set<string> {
  const active = offerings.filter((o) => !o.isArchived);
  const ids = new Set<string>();
  for (const o of active) {
    for (const pid of parentIdsOf(o)) ids.add(pid);
  }
  return ids;
}

export function offeringRole<T extends OfferingHierarchyFields>(
  offering: T,
  majorsWithChildren: Set<string>,
): OfferingRole {
  if (hasParents(offering)) return "item";
  if (majorsWithChildren.has(offering.id)) return "major";
  return "standalone";
}

export function offeringRoleLabel(role: OfferingRole): string {
  if (role === "major") return "Major choice";
  if (role === "item") return "Item under major choice";
  return "Standalone offering";
}

/** Top-level offerings suitable as primary couple choices (not child items). */
export function topLevelOfferings<T extends OfferingHierarchyFields>(offerings: T[]): T[] {
  return offerings.filter((o) => !o.isArchived && !hasParents(o));
}

/** Associated items that list this major among their parents. */
export function childOfferings<T extends OfferingHierarchyFields>(
  offerings: T[],
  parentId: string,
): T[] {
  return offerings.filter((o) => !o.isArchived && parentIdsOf(o).includes(parentId));
}

/**
 * Filter catalog picks for Event Order authoring.
 * - primary: top-level majors/standalones (never child rows)
 * - underMajor: children of that major; if none exist yet, fall back to same-category
 *   top-level so venues are not blocked mid-migration (caller may warn)
 * - all: no hierarchy filter
 */
export function filterOfferingsForAuthoringContext<T extends OfferingHierarchyFields>(
  offerings: T[],
  context:
    | { kind: "primary" }
    | { kind: "underMajor"; parentOfferingId: string }
    | { kind: "all" },
): { items: T[]; usedFallback: boolean } {
  const active = offerings.filter((o) => !o.isArchived);
  if (context.kind === "all") return { items: active, usedFallback: false };
  if (context.kind === "primary") {
    return { items: topLevelOfferings(active), usedFallback: false };
  }
  const children = childOfferings(active, context.parentOfferingId);
  if (children.length > 0) return { items: children, usedFallback: false };
  const parent = active.find((o) => o.id === context.parentOfferingId);
  const fallback = topLevelOfferings(active).filter((o) => {
    if (o.id === context.parentOfferingId) return false;
    if (!parent?.categoryId) return true;
    return o.categoryId === parent.categoryId;
  });
  return { items: fallback, usedFallback: fallback.length > 0 };
}

/**
 * Stable list order: category → majors → nested children → standalones.
 * Multi-parent items appear once, nested under their first parent (by parent name
 * among parents present in the category), so the catalog does not look duplicated.
 */
export function orderOfferingsHierarchically<T extends OfferingHierarchyFields>(
  offerings: T[],
): T[] {
  const byCat = new Map<string, T[]>();
  for (const o of offerings) {
    const key = o.categoryId ?? "__none__";
    const list = byCat.get(key) ?? [];
    list.push(o);
    byCat.set(key, list);
  }
  const out: T[] = [];
  for (const list of byCat.values()) {
    const tops = list
      .filter((o) => !hasParents(o))
      .sort((a, b) => a.name.localeCompare(b.name));
    const children = list.filter((o) => hasParents(o));
    const topIds = new Set(tops.map((t) => t.id));
    const nameById = new Map(list.map((o) => [o.id, o.name]));

    for (const top of tops) {
      out.push(top);
      out.push(
        ...children
          .filter((c) => {
            const parents = parentIdsOf(c).filter((pid) => topIds.has(pid));
            if (parents.length === 0) return false;
            const primary = [...parents].sort((a, b) =>
              (nameById.get(a) ?? a).localeCompare(nameById.get(b) ?? b),
            )[0];
            return primary === top.id;
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    const placed = new Set(out.map((o) => o.id));
    out.push(
      ...children
        .filter((c) => !placed.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return out;
}

/** Display label for parent majors, e.g. "Plated Dinner, Buffet Dinner". */
export function formatParentOfferingNames(names: string[]): string | null {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  return cleaned.join(", ");
}
