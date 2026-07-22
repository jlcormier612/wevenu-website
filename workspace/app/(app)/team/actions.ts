"use server";

import { revalidatePath } from "next/cache";

import { actorCan } from "@/lib/program4/session";
import { getTeamProfileSync, upsertTeamProfile } from "@/lib/program4/store";
import type { TeamAvailability, TeamMemberProfile, TeamRole } from "@/lib/program4/types";

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
  const territoryRaw = String(formData.get("territory") || "").trim();
  const commissionPlanId = String(formData.get("commissionPlanId") || "").trim();

  const next: TeamMemberProfile = {
    ...existing,
    role,
    title: title || existing.title,
    availability,
    territory: territoryRaw || null,
    commissionPlanId: commissionPlanId || null,
  };

  await upsertTeamProfile(next);
  revalidatePath("/team");
  revalidatePath(`/team/${id}`);
  revalidatePath("/settings");
}
