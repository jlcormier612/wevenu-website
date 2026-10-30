/**
 * Catalog choice groups under parent/major Offerings.
 * Template selection rules stay on event_order_template_groups;
 * this module owns reusable organization + membership only.
 */
import {
  orderOfferingsHierarchically,
  parentIdsOf,
  type OfferingHierarchyFields,
} from "@/lib/offerings/hierarchy";
import type { OfferingWithCategory } from "@/lib/offerings/types";

export type OfferingChoiceGroup = {
  id: string;
  venueId: string;
  parentOfferingId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  memberOfferingIds: string[];
};

export type OfferingChoiceGroupMember = {
  id: string;
  venueId: string;
  groupId: string;
  offeringId: string;
  sortOrder: number;
  createdAt: string;
};

export type ChoiceGroupRow = {
  id: string;
  venue_id: string;
  parent_offering_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ChoiceGroupMemberRow = {
  id: string;
  venue_id: string;
  group_id: string;
  offering_id: string;
  sort_order: number;
  created_at: string;
};

export function mapChoiceGroup(
  row: ChoiceGroupRow,
  memberOfferingIds: string[] = [],
): OfferingChoiceGroup {
  return {
    id: row.id,
    venueId: row.venue_id,
    parentOfferingId: row.parent_offering_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberOfferingIds,
  };
}

export function mapChoiceGroupMember(row: ChoiceGroupMemberRow): OfferingChoiceGroupMember {
  return {
    id: row.id,
    venueId: row.venue_id,
    groupId: row.group_id,
    offeringId: row.offering_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

/** Groups for one parent, sorted. */
export function groupsForParent(
  groups: OfferingChoiceGroup[],
  parentOfferingId: string,
): OfferingChoiceGroup[] {
  return groups
    .filter((g) => g.parentOfferingId === parentOfferingId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * Catalog groups under a parent that are not already linked on a template
 * under the given parent option (by offering_choice_group_id).
 */
export function catalogGroupsAvailableToInclude(
  catalogGroups: OfferingChoiceGroup[],
  parentOfferingId: string,
  parentOptionId: string,
  templateGroups: Array<{
    id: string;
    offeringChoiceGroupId?: string | null;
    dependsOnOptionIds: string[];
  }>,
): OfferingChoiceGroup[] {
  const already = new Set(
    templateGroups
      .filter(
        (g) =>
          (g.dependsOnOptionIds ?? []).includes(parentOptionId) &&
          g.offeringChoiceGroupId,
      )
      .map((g) => g.offeringChoiceGroupId as string),
  );
  return groupsForParent(catalogGroups, parentOfferingId).filter((g) => !already.has(g.id));
}

/** Members of a group as Offering rows, preserving membership order. */
export function memberOfferingsForGroup(
  group: OfferingChoiceGroup,
  catalog: OfferingWithCategory[],
): OfferingWithCategory[] {
  const byId = new Map(catalog.map((o) => [o.id, o]));
  return group.memberOfferingIds
    .map((id) => byId.get(id))
    .filter((o): o is OfferingWithCategory => o != null && !o.isArchived);
}

/** Eligible children of a parent that are not yet in this group. */
export function eligibleChildrenNotInGroup(
  catalog: OfferingWithCategory[],
  parentOfferingId: string,
  group: OfferingChoiceGroup,
): OfferingWithCategory[] {
  const inGroup = new Set(group.memberOfferingIds);
  return catalog.filter((o) => {
    if (o.isArchived || inGroup.has(o.id)) return false;
    const parents = parentIdsOf(o);
    if (parents.includes(parentOfferingId)) return true;
    // Legacy single parent when parentOfferingIds is an explicit empty array.
    return o.parentOfferingId === parentOfferingId;
  });
}

export type ConvertToCategoryTarget = {
  parentOfferingId: string;
  /** Existing category under this parent with the same name (reused, not duplicated). */
  existingGroupId: string | null;
  /** Sibling items under this parent that can move into the new category. */
  candidateMemberIds: string[];
  /** Candidates already in that existing category. */
  alreadyMemberIds: string[];
};

/**
 * Plan for turning a legacy item that is really a category (for example an
 * "Entrées" Offering under Plated Dinner) into a real category under each of
 * its parents. Siblings stay catalog items; the venue picks which move in.
 */
export function planConvertItemToCategory(
  item: OfferingWithCategory,
  catalog: OfferingWithCategory[],
  groups: OfferingChoiceGroup[],
): ConvertToCategoryTarget[] {
  const name = sanitizeChoiceGroupName(item.name).toLocaleLowerCase();
  const parents = parentIdsOf(item).length > 0
    ? parentIdsOf(item)
    : item.parentOfferingId
      ? [item.parentOfferingId]
      : [];
  return parents.map((parentOfferingId) => {
    const existing = groupsForParent(groups, parentOfferingId).find(
      (g) => g.name.toLocaleLowerCase() === name,
    );
    const candidateMemberIds = catalog
      .filter(
        (o) =>
          o.id !== item.id &&
          !o.isArchived &&
          (parentIdsOf(o).includes(parentOfferingId) || o.parentOfferingId === parentOfferingId),
      )
      .map((o) => o.id);
    return {
      parentOfferingId,
      existingGroupId: existing?.id ?? null,
      candidateMemberIds,
      alreadyMemberIds: existing
        ? candidateMemberIds.filter((id) => existing.memberOfferingIds.includes(id))
        : [],
    };
  });
}

export function sanitizeChoiceGroupName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 80);
}

/**
 * Catalog list row: either a real Offering or a named choice-group heading
 * (not an Offering). Groups nest under their parent major; members nest under
 * the group. Ungrouped children remain under the major.
 */
export type CatalogListRow<T extends OfferingHierarchyFields = OfferingWithCategory> =
  | {
      kind: "offering";
      offering: T;
      nestUnderParentId: string | null;
      nestUnderGroupId: string | null;
    }
  | {
      kind: "choice-group";
      group: OfferingChoiceGroup;
      nestUnderParentId: string;
    };

/**
 * Expand hierarchical placements so Major → Choice group → items is visible
 * in the Offerings catalog list. Does not invent offerings or duplicate rows
 * for the same (offering, parent, group) placement.
 */
export function orderCatalogListWithChoiceGroups<T extends OfferingHierarchyFields>(
  offerings: T[],
  choiceGroups: OfferingChoiceGroup[],
): CatalogListRow<T>[] {
  const placements = orderOfferingsHierarchically(offerings);
  const byId = new Map(offerings.map((o) => [o.id, o]));
  const out: CatalogListRow<T>[] = [];

  for (const { offering, nestUnderParentId } of placements) {
    if (nestUnderParentId != null) {
      // Children are emitted under their major below (grouped / ungrouped).
      continue;
    }

    out.push({
      kind: "offering",
      offering,
      nestUnderParentId: null,
      nestUnderGroupId: null,
    });

    const parentGroups = groupsForParent(choiceGroups, offering.id);
    const children = placements
      .filter((p) => p.nestUnderParentId === offering.id)
      .map((p) => p.offering);

    if (parentGroups.length === 0) {
      for (const child of children) {
        out.push({
          kind: "offering",
          offering: child,
          nestUnderParentId: offering.id,
          nestUnderGroupId: null,
        });
      }
      continue;
    }

    const placedInGroup = new Set<string>();
    for (const g of parentGroups) {
      out.push({ kind: "choice-group", group: g, nestUnderParentId: offering.id });
      for (const memberId of g.memberOfferingIds) {
        const member = byId.get(memberId);
        if (!member || member.isArchived) continue;
        const underParent =
          parentIdsOf(member).includes(offering.id) ||
          member.parentOfferingId === offering.id;
        if (!underParent) continue;
        out.push({
          kind: "offering",
          offering: member,
          nestUnderParentId: offering.id,
          nestUnderGroupId: g.id,
        });
        placedInGroup.add(member.id);
      }
    }
    for (const child of children) {
      if (placedInGroup.has(child.id)) continue;
      out.push({
        kind: "offering",
        offering: child,
        nestUnderParentId: offering.id,
        nestUnderGroupId: null,
      });
    }
  }

  return out;
}
