"use server";

import { revalidatePath } from "next/cache";
import {
  inviteStaffMember,
  removeStaffMember,
  updateStaffRole,
} from "@/lib/team/service";
import type { StaffInput, TeamActionResult, StaffRole } from "@/lib/team/types";

export async function inviteTeamMemberAction(
  input: StaffInput,
): Promise<TeamActionResult> {
  const result = await inviteStaffMember(input);
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

export async function updateTeamMemberRoleAction(
  staffId: string,
  role: StaffRole,
): Promise<TeamActionResult> {
  const result = await updateStaffRole(staffId, role);
  if ("ok" in result && result.ok) revalidatePath("/settings/team");
  return result as TeamActionResult;
}
