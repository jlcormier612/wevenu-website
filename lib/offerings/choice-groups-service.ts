/**
 * Venue-scoped service for catalog choice groups.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  sanitizeChoiceGroupName,
  type OfferingChoiceGroup,
} from "@/lib/offerings/choice-groups";
import * as repo from "@/lib/offerings/choice-groups-repository";
import { getCurrentVenue } from "@/lib/venue/service";

export type ChoiceGroupActionResult =
  | { ok: true; group?: OfferingChoiceGroup }
  | { ok: false; message: string };

function writeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/unique|duplicate/i.test(raw)) {
    return "A group with that name already exists under this parent Offering.";
  }
  if (/top-level major/i.test(raw)) {
    return "Choice groups can only be created under a parent (major) Offering.";
  }
  if (/must belong under the group parent/i.test(raw)) {
    return "That item is not linked under this parent Offering in the catalog.";
  }
  if (/venue_id must match|same venue/i.test(raw)) {
    return "Offerings must stay within this venue.";
  }
  return raw.slice(0, 220) || "Could not save choice group.";
}

async function withVenue<T>(
  fn: (client: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  return fn(supabase, venue.id);
}

export async function listOfferingChoiceGroups(): Promise<OfferingChoiceGroup[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  try {
    return await repo.listChoiceGroupsForVenue(supabase, venue.id);
  } catch {
    // Table may not exist until migration is applied.
    return [];
  }
}

export async function createOfferingChoiceGroup(
  parentOfferingId: string,
  name: string,
): Promise<ChoiceGroupActionResult> {
  const trimmed = sanitizeChoiceGroupName(name);
  if (!trimmed) return { ok: false, message: "Enter a group name." };
  if (!parentOfferingId) return { ok: false, message: "Parent Offering is required." };
  const result = await withVenue(async (c, venueId) => {
    try {
      const sortOrder = await repo.nextChoiceGroupSortOrder(c, venueId, parentOfferingId);
      const group = await repo.insertChoiceGroup(
        c,
        venueId,
        parentOfferingId,
        trimmed,
        sortOrder,
      );
      return { ok: true as const, group };
    } catch (err) {
      return { ok: false as const, message: writeErrorMessage(err) };
    }
  });
  return result as ChoiceGroupActionResult;
}

export async function renameOfferingChoiceGroup(
  groupId: string,
  name: string,
): Promise<ChoiceGroupActionResult> {
  const trimmed = sanitizeChoiceGroupName(name);
  if (!trimmed) return { ok: false, message: "Enter a group name." };
  const result = await withVenue(async (c, venueId) => {
    try {
      await repo.updateChoiceGroupName(c, venueId, groupId, trimmed);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, message: writeErrorMessage(err) };
    }
  });
  return result as ChoiceGroupActionResult;
}

export async function deleteOfferingChoiceGroup(
  groupId: string,
): Promise<ChoiceGroupActionResult> {
  const result = await withVenue(async (c, venueId) => {
    try {
      await repo.deleteChoiceGroup(c, venueId, groupId);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, message: writeErrorMessage(err) };
    }
  });
  return result as ChoiceGroupActionResult;
}

export async function setOfferingChoiceGroupMembers(
  groupId: string,
  offeringIds: string[],
): Promise<ChoiceGroupActionResult> {
  const unique = [...new Set(offeringIds.filter(Boolean))];
  const result = await withVenue(async (c, venueId) => {
    try {
      await repo.replaceChoiceGroupMembers(c, venueId, groupId, unique);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, message: writeErrorMessage(err) };
    }
  });
  return result as ChoiceGroupActionResult;
}

export async function addOfferingChoiceGroupMember(
  groupId: string,
  offeringId: string,
): Promise<ChoiceGroupActionResult> {
  const result = await withVenue(async (c, venueId) => {
    try {
      const groups = await repo.listChoiceGroupsForVenue(c, venueId);
      const group = groups.find((g) => g.id === groupId);
      const sortOrder = group?.memberOfferingIds.length ?? 0;
      await repo.addChoiceGroupMember(c, venueId, groupId, offeringId, sortOrder);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, message: writeErrorMessage(err) };
    }
  });
  return result as ChoiceGroupActionResult;
}

export async function removeOfferingChoiceGroupMember(
  groupId: string,
  offeringId: string,
): Promise<ChoiceGroupActionResult> {
  const result = await withVenue(async (c, venueId) => {
    try {
      await repo.removeChoiceGroupMember(c, venueId, groupId, offeringId);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, message: writeErrorMessage(err) };
    }
  });
  return result as ChoiceGroupActionResult;
}
