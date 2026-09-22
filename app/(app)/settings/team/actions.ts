"use server";

import { revalidatePath } from "next/cache";
import {
  inviteStaffMember,
  removeStaffMember,
  transferVenueOwnership,
  updateStaffAccess,
  updateStaffRole,
} from "@/lib/team/service";
import type {
  StaffAccessUpdate,
  StaffInviteInput,
  StaffInput,
  StaffRole,
  TeamActionResult,
} from "@/lib/team/types";
import type { AccessTitle } from "@/lib/authorization";

export async function inviteTeamMemberAction(
  input: StaffInviteInput | StaffInput,
): Promise<TeamActionResult> {
  const normalized: StaffInviteInput =
    "accessTitle" in input
      ? input
      : {
          name: input.name,
          email: input.email,
          accessTitle: legacyRoleToAccessTitle(input.role),
          isOwner: input.role === "owner",
        };
  const result = await inviteStaffMember(normalized);
  if ("ok" in result && result.ok) revalidatePath("/settings/team");
  return result as TeamActionResult;
}

export async function removeTeamMemberAction(
  staffId: string,
): Promise<TeamActionResult> {
  const result = await removeStaffMember(staffId);
  if ("ok" in result && result.ok) revalidatePath("/settings/team");
  return result as TeamActionResult;
}

export async function updateTeamMemberAccessAction(
  staffId: string,
  update: StaffAccessUpdate,
): Promise<TeamActionResult> {
  const result = await updateStaffAccess(staffId, update);
  if ("ok" in result && result.ok) revalidatePath("/settings/team");
  return result as TeamActionResult;
}

/** @deprecated Prefer updateTeamMemberAccessAction */
export async function updateTeamMemberRoleAction(
  staffId: string,
  role: StaffRole,
): Promise<TeamActionResult> {
  const result = await updateStaffRole(staffId, role);
  if ("ok" in result && result.ok) revalidatePath("/settings/team");
  return result as TeamActionResult;
}

export async function transferOwnershipAction(
  fromStaffId: string,
  toStaffId: string,
): Promise<TeamActionResult> {
  const result = await transferVenueOwnership(fromStaffId, toStaffId);
  if ("ok" in result && result.ok) revalidatePath("/settings/team");
  return result as TeamActionResult;
}

function legacyRoleToAccessTitle(role: StaffRole): AccessTitle {
  if (role === "owner") return "administrator";
  return role;
}
