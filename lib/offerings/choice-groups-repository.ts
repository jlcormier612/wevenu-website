/**
 * Persistence for offering_choice_groups + members.
 */
import type {
  ChoiceGroupMemberRow,
  ChoiceGroupRow,
  OfferingChoiceGroup,
} from "@/lib/offerings/choice-groups";
import { mapChoiceGroup, mapChoiceGroupMember } from "@/lib/offerings/choice-groups";

type DbClient = {
  from: (table: string) => any;
};

export async function listChoiceGroupsForVenue(
  client: DbClient,
  venueId: string,
): Promise<OfferingChoiceGroup[]> {
  const { data: groups, error } = await client
    .from("offering_choice_groups")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order")
    .order("name");
  if (error) throw error;

  const { data: members, error: memErr } = await client
    .from("offering_choice_group_members")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order");
  if (memErr) throw memErr;

  const membersByGroup = new Map<string, ChoiceGroupMemberRow[]>();
  for (const row of (members as ChoiceGroupMemberRow[] | null) ?? []) {
    const list = membersByGroup.get(row.group_id) ?? [];
    list.push(row);
    membersByGroup.set(row.group_id, list);
  }

  return ((groups as ChoiceGroupRow[] | null) ?? []).map((g) => {
    const mems = (membersByGroup.get(g.id) ?? []).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    return mapChoiceGroup(
      g,
      mems.map((m) => m.offering_id),
    );
  });
}

export async function listChoiceGroupsForParent(
  client: DbClient,
  venueId: string,
  parentOfferingId: string,
): Promise<OfferingChoiceGroup[]> {
  const all = await listChoiceGroupsForVenue(client, venueId);
  return all.filter((g) => g.parentOfferingId === parentOfferingId);
}

export async function insertChoiceGroup(
  client: DbClient,
  venueId: string,
  parentOfferingId: string,
  name: string,
  sortOrder: number,
): Promise<OfferingChoiceGroup> {
  const { data, error } = await client
    .from("offering_choice_groups")
    .insert({
      venue_id: venueId,
      parent_offering_id: parentOfferingId,
      name,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapChoiceGroup(data as ChoiceGroupRow, []);
}

export async function updateChoiceGroupName(
  client: DbClient,
  venueId: string,
  groupId: string,
  name: string,
): Promise<void> {
  const { error } = await client
    .from("offering_choice_groups")
    .update({ name })
    .eq("id", groupId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateChoiceGroupSortOrders(
  client: DbClient,
  venueId: string,
  orderedIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await client
      .from("offering_choice_groups")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("venue_id", venueId);
    if (error) throw error;
  }
}

export async function deleteChoiceGroup(
  client: DbClient,
  venueId: string,
  groupId: string,
): Promise<void> {
  const { error } = await client
    .from("offering_choice_groups")
    .delete()
    .eq("id", groupId)
    .eq("venue_id", venueId);
  if (error) throw error;
}

export async function addChoiceGroupMember(
  client: DbClient,
  venueId: string,
  groupId: string,
  offeringId: string,
  sortOrder: number,
): Promise<void> {
  const { error } = await client.from("offering_choice_group_members").insert({
    venue_id: venueId,
    group_id: groupId,
    offering_id: offeringId,
    sort_order: sortOrder,
  });
  if (error) throw error;
}

export async function removeChoiceGroupMember(
  client: DbClient,
  venueId: string,
  groupId: string,
  offeringId: string,
): Promise<void> {
  const { error } = await client
    .from("offering_choice_group_members")
    .delete()
    .eq("venue_id", venueId)
    .eq("group_id", groupId)
    .eq("offering_id", offeringId);
  if (error) throw error;
}

export async function replaceChoiceGroupMembers(
  client: DbClient,
  venueId: string,
  groupId: string,
  offeringIds: string[],
): Promise<void> {
  const { error: delErr } = await client
    .from("offering_choice_group_members")
    .delete()
    .eq("venue_id", venueId)
    .eq("group_id", groupId);
  if (delErr) throw delErr;

  if (offeringIds.length === 0) return;
  const rows = offeringIds.map((offering_id, i) => ({
    venue_id: venueId,
    group_id: groupId,
    offering_id,
    sort_order: i,
  }));
  const { error } = await client.from("offering_choice_group_members").insert(rows);
  if (error) throw error;
}

export async function nextChoiceGroupSortOrder(
  client: DbClient,
  venueId: string,
  parentOfferingId: string,
): Promise<number> {
  const { data } = await client
    .from("offering_choice_groups")
    .select("sort_order")
    .eq("venue_id", venueId)
    .eq("parent_offering_id", parentOfferingId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
}

export { mapChoiceGroupMember };
