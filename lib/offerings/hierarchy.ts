/**
 * Offerings catalog hierarchy helpers — major choices vs associated items.
 * One nesting level. Existing flat offerings (parent null) remain valid.
 */

export type OfferingHierarchyFields = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string | null;
  parentOfferingId: string | null;
  isArchived?: boolean;
};

export type OfferingRole = "major" | "item" | "standalone";

/** Top-level rows that have at least one non-archived child. */
export function majorOfferingIds<T extends OfferingHierarchyFields>(
  offerings: T[],
): Set<string> {
  const active = offerings.filter((o) => !o.isArchived);
  const ids = new Set<string>();
  for (const o of active) {
    if (o.parentOfferingId) ids.add(o.parentOfferingId);
  }
  return ids;
}

export function offeringRole<T extends OfferingHierarchyFields>(
  offering: T,
  majorsWithChildren: Set<string>,
): OfferingRole {
  if (offering.parentOfferingId) return "item";
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
  return offerings.filter((o) => !o.isArchived && !o.parentOfferingId);
}

/** Associated items directly under a major offering. */
export function childOfferings<T extends OfferingHierarchyFields>(
  offerings: T[],
  parentId: string,
): T[] {
  return offerings.filter((o) => !o.isArchived && o.parentOfferingId === parentId);
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

/** Stable list order: category → majors → nested children → standalones. */
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
      .filter((o) => !o.parentOfferingId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const children = list.filter((o) => o.parentOfferingId);
    for (const top of tops) {
      out.push(top);
      out.push(
        ...children
          .filter((c) => c.parentOfferingId === top.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    // Orphans (parent missing / archived) last within category
    const placed = new Set(out.map((o) => o.id));
    out.push(
      ...children
        .filter((c) => !placed.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return out;
}
