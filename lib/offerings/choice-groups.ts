/**
 * Catalog choice groups under parent/major Offerings.
 * Template selection rules stay on event_order_template_groups;
 * this module owns reusable organization + membership only.
 */
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
  return catalog.filter(
    (o) =>
      !o.isArchived &&
      !inGroup.has(o.id) &&
      (o.parentOfferingIds?.includes(parentOfferingId) ||
        o.parentOfferingId === parentOfferingId),
  );
}

export function sanitizeChoiceGroupName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 80);
}
