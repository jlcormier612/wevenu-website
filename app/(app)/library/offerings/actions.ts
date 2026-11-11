"use server";

import { revalidatePath } from "next/cache";

import {
  addOfferingChoiceGroupMember,
  createOfferingChoiceGroup,
  deleteOfferingChoiceGroup,
  removeOfferingChoiceGroupMember,
  renameOfferingChoiceGroup,
  setOfferingChoiceGroupMembers,
  type ChoiceGroupActionResult,
} from "@/lib/offerings/choice-groups-service";
import {
  createOffering, createOfferingCategory, setOfferingArchived, updateOffering, updateOfferingImage,
} from "@/lib/offerings/service";
import type { OfferingActionResult, OfferingInput } from "@/lib/offerings/types";

function revalidate() {
  revalidatePath("/library/offerings");
  revalidatePath("/library");
  revalidatePath("/library/event-order-templates");
}

export async function createOfferingAction(input: OfferingInput) {
  const result = await createOffering(input);
  if (result.ok) revalidate();
  return result;
}

export async function updateOfferingAction(id: string, input: OfferingInput) {
  const result = await updateOffering(id, input);
  if (result.ok) revalidate();
  return result;
}

export async function setOfferingArchivedAction(id: string, archived: boolean): Promise<OfferingActionResult> {
  const result = await setOfferingArchived(id, archived);
  if (result.ok) revalidate();
  return result;
}

export async function createOfferingCategoryAction(name: string) {
  const result = await createOfferingCategory(name);
  if (result.ok) revalidate();
  return result;
}

export async function updateOfferingImageAction(
  id: string,
  imageUrl: string | null,
): Promise<OfferingActionResult> {
  const result = await updateOfferingImage(id, imageUrl);
  if (result.ok) revalidate();
  return result;
}

export async function createOfferingChoiceGroupAction(
  parentOfferingId: string,
  name: string,
): Promise<ChoiceGroupActionResult> {
  const result = await createOfferingChoiceGroup(parentOfferingId, name);
  if (result.ok) revalidate();
  return result;
}

export async function renameOfferingChoiceGroupAction(
  groupId: string,
  name: string,
): Promise<ChoiceGroupActionResult> {
  const result = await renameOfferingChoiceGroup(groupId, name);
  if (result.ok) revalidate();
  return result;
}

export async function deleteOfferingChoiceGroupAction(
  groupId: string,
): Promise<ChoiceGroupActionResult> {
  const result = await deleteOfferingChoiceGroup(groupId);
  if (result.ok) revalidate();
  return result;
}

export async function setOfferingChoiceGroupMembersAction(
  groupId: string,
  offeringIds: string[],
): Promise<ChoiceGroupActionResult> {
  const result = await setOfferingChoiceGroupMembers(groupId, offeringIds);
  if (result.ok) revalidate();
  return result;
}

export async function addOfferingChoiceGroupMemberAction(
  groupId: string,
  offeringId: string,
): Promise<ChoiceGroupActionResult> {
  const result = await addOfferingChoiceGroupMember(groupId, offeringId);
  if (result.ok) revalidate();
  return result;
}

export async function removeOfferingChoiceGroupMemberAction(
  groupId: string,
  offeringId: string,
): Promise<ChoiceGroupActionResult> {
  const result = await removeOfferingChoiceGroupMember(groupId, offeringId);
  if (result.ok) revalidate();
  return result;
}
