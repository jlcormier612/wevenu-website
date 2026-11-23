"use server";

import { revalidatePath } from "next/cache";

import { actorCan } from "@/lib/program4/session";
import { getTeamProfileSync, upsertTeamProfile } from "@/lib/program4/store";
import {
  composeDisplayName,
  initialsFromDisplayName,
} from "@/lib/program4/team-profile-fields";
import type {
  TeamAvailability,
  TeamDepartment,
  TeamMemberProfile,
  TeamRole,
} from "@/lib/program4/types";
import { isSupabaseStaffAuthEnabled } from "@/lib/supabase/workspace-auth-config";

const DEPARTMENTS = new Set<TeamDepartment>([
  "leadership",
  "sales",
  "customer_success",
  "implementation",
  "support",
  "finance",
  "marketing",
]);

export async function updateTeamMemberAction(formData: FormData) {
  if (!(await actorCan("manage_team"))) return;

  const id = String(formData.get("id") || "").trim();
  const existing = getTeamProfileSync(id);
  if (!existing) return;

  const role = String(formData.get("role") || existing.role) as TeamRole;
  const availability = String(
    formData.get("availability") || existing.availability,
  ) as TeamAvailability;
  const title = String(formData.get("title") || existing.title).trim();
  const departmentRaw = String(
    formData.get("department") || existing.department,
  ).trim() as TeamDepartment;
  const department = DEPARTMENTS.has(departmentRaw)
    ? departmentRaw
    : existing.department;
  // Territory field is hidden in Stage 1F UI — preserve existing value.
  const commissionPlanId = String(formData.get("commissionPlanId") || "").trim();

  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const composedName = composeDisplayName(firstName, lastName);
  const name = composedName || existing.name;

  let email = existing.email;
  let authLinkedEmail = false;

  if (isSupabaseStaffAuthEnabled()) {
    const { getStaffAclRepository } = await import("@/lib/program4/staff-acl");
    const staff = await getStaffAclRepository().getByTeamMemberId(id);
    if (staff?.active) {
      // Login email lives on htc_internal_staff / Auth — never rewrite from CRM form.
      authLinkedEmail = true;
      email = staff.email;
      if (staff.displayName !== name) {
        await getStaffAclRepository().upsertStaff({
          ...staff,
          displayName: name,
          updatedAt: new Date().toISOString(),
        });
        await getStaffAclRepository().appendAudit({
          actorUserId: null,
          action: "crm_profile_display_name_update",
          targetUserId: staff.userId,
          targetEmail: staff.email,
          detail: { teamMemberId: id, displayName: name },
        });
      }
    }
  }

  if (!authLinkedEmail) {
    const emailRaw = String(formData.get("email") || "").trim().toLowerCase();
    if (emailRaw && emailRaw.includes("@")) {
      email = emailRaw;
    }
  }

  const next: TeamMemberProfile = {
    ...existing,
    name,
    email,
    initials: initialsFromDisplayName(name),
    role,
    title: title || existing.title,
    department,
    availability,
    territory: existing.territory ?? null,
    commissionPlanId: commissionPlanId || null,
  };

  await upsertTeamProfile(next);
  revalidatePath("/team");
  revalidatePath(`/team/${id}`);
  revalidatePath("/settings");
  revalidatePath("/business");
  revalidatePath("/today");
}
