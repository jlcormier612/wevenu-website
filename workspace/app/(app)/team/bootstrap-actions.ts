"use server";

import { redirect } from "next/navigation";

import { initialsFromName, roleDefaultTitle, roleToDepartment } from "@/lib/program4/auth-store";
import { bootstrapFirstOwner } from "@/lib/program4/staff-auth-service";
import { getTeamProfilesSync, upsertTeamProfile } from "@/lib/program4/store";
import { isSupabaseStaffAuthEnabled } from "@/lib/supabase/workspace-auth-config";

/**
 * One-time first Owner bootstrap.
 * Requires WORKSPACE_BOOTSTRAP_SECRET matching form field.
 * When WORKSPACE_BOOTSTRAP_OWNER_EMAIL is set, only that email may bootstrap.
 *
 * If the Auth user already exists (common for venue identities), this links
 * ACL only — it does not create a second account, change passwords, or modify
 * venue/client/vendor memberships.
 *
 * Disabled once any active Owner exists.
 */
export async function bootstrapFirstOwnerAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  if (!isSupabaseStaffAuthEnabled()) {
    return { error: "Bootstrap requires Supabase staff auth." };
  }

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const displayName = String(formData.get("displayName") || "").trim();
  const bootstrapSecret = String(formData.get("bootstrapSecret") || "");
  // Password optional when linking an existing Auth user (sign-in uses existing creds).
  const password = String(formData.get("password") || "");

  if (!email) {
    return { error: "Email is required." };
  }
  if (!bootstrapSecret) {
    return { error: "Bootstrap secret is required." };
  }

  const { createWorkspaceAdminClient } = await import("@/lib/supabase/server");
  const admin = createWorkspaceAdminClient();

  // Prefer existing Auth identity (do not invent a parallel account).
  // Must paginate — Sandbox Auth user lists exceed a single page.
  let userId: string | null = null;
  {
    const perPage = 200;
    const maxPages = 50;
    for (let page = 1; page <= maxPages; page += 1) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (listError) {
        return { error: "Could not look up Auth users for bootstrap." };
      }
      const users = listed.users || [];
      const match = users.find((u) => (u.email || "").toLowerCase() === email);
      if (match) {
        userId = match.id;
        break;
      }
      if (users.length < perPage) {
        break;
      }
    }
  }

  const approvedOwnerEmail = (process.env.WORKSPACE_BOOTSTRAP_OWNER_EMAIL || "")
    .trim()
    .toLowerCase();
  // When an approved Owner email is configured (R1B cutover), never create a
  // second Auth identity — only link the existing user.
  if (!userId && approvedOwnerEmail && email === approvedOwnerEmail) {
    return {
      error:
        "Approved Owner Auth user was not found. Refusing to create a new Auth identity.",
    };
  }

  if (!userId) {
    if (!password || password.length < 12) {
      return {
        error:
          "No existing Auth user for this email. Provide a password of at least 12 characters to create one.",
      };
    }
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        htc_workspace_bootstrap: true,
        display_name: displayName || email,
      },
    });
    if (error || !created.user) {
      return { error: "Could not create Auth user for bootstrap." };
    }
    userId = created.user.id;
  }

  // Prefer existing Program4 roster id when email already mirrors (e.g. tm_jen).
  const roster = getTeamProfilesSync().find((m) => m.email.toLowerCase() === email);

  const result = await bootstrapFirstOwner({
    userId,
    email,
    displayName: displayName || roster?.name || email,
    bootstrapSecret,
    teamMemberId: roster?.id ?? null,
  });
  if (!result.ok) {
    return { error: result.error };
  }

  await upsertTeamProfile({
    id: result.staff.teamMemberId,
    name: result.staff.displayName,
    email: result.staff.email,
    initials: initialsFromName(result.staff.displayName),
    role: "owner",
    title: roster?.title || roleDefaultTitle("owner"),
    department: roster?.department || roleToDepartment("owner"),
    commissionPlanId: roster?.commissionPlanId ?? null,
    goals: roster?.goals ?? [],
    availability: roster?.availability ?? "available",
    territory: roster?.territory ?? null,
    active: true,
    joinedAt: roster?.joinedAt ?? result.staff.createdAt,
  });

  // Do not auto sign-in here when linking an existing venue identity —
  // founder signs in with the existing Auth password after bootstrap.
  redirect("/login?bootstrapped=1");
}
