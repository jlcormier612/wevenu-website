"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { sendRawEmail } from "@shared/email";

import {
  createSession,
  deleteSession,
  getCredentialByEmailSync,
  getInviteByTokenSync,
  getPendingInvitesSync,
  initialsFromName,
  inviteAcceptUrl,
  newInviteToken,
  roleDefaultTitle,
  roleToDepartment,
  upsertCredential,
  upsertInvite,
  workspaceBaseUrl,
} from "@/lib/program4/auth-store";
import { hashPassword, verifyPassword } from "@/lib/program4/password";
import { ROLE_LABELS, TEAM_ROLES } from "@/lib/program4/labels";
import {
  AUTH_COOKIE,
  ACTOR_COOKIE,
  IMPERSONATE_COOKIE,
  SESSION_COOKIE,
  actorCan,
  getSessionMember,
  roleCanImpersonate,
  shouldUseSecureCookies,
} from "@/lib/program4/session";
import {
  acceptStaffInvite,
  createStaffInvite,
  resolveStaffAfterAuth,
} from "@/lib/program4/staff-auth-service";
import { getStaffAclRepository } from "@/lib/program4/staff-acl";
import {
  ensureProgram4Data,
  getTeamProfileSync,
  getTeamProfilesSync,
  newProgram4Id,
  upsertTeamProfile,
} from "@/lib/program4/store";
import type { TeamInvite, TeamMemberProfile, TeamRole } from "@/lib/program4/types";
import { isSupabaseStaffAuthEnabled } from "@/lib/supabase/workspace-auth-config";

/** CRM sessions: Secure on HTTPS/production; plain http://localhost keeps Secure off. */
function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: shouldUseSecureCookies(),
  };
}

/** 30 days — legacy JSONL sessions only. */
const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;

async function clearLegacyCookies(jar: Awaited<ReturnType<typeof cookies>>) {
  jar.delete(AUTH_COOKIE);
  jar.delete(ACTOR_COOKIE);
}

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  await ensureProgram4Data();

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const nextRaw = String(formData.get("next") || "/business");
  const next = nextRaw.startsWith("/") ? nextRaw : "/business";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (isSupabaseStaffAuthEnabled()) {
    const { createWorkspaceAuthClient } = await import("@/lib/supabase/server");
    const supabase = await createWorkspaceAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      return { error: "Invalid email or password." };
    }
    const resolved = await resolveStaffAfterAuth(
      data.user.id,
      data.user.email ?? email,
    );
    if (!resolved.ok) {
      await supabase.auth.signOut();
      return { error: resolved.error };
    }
    // Sync Program4 profile mirror for CRM UI that still reads JSONL roster.
    const staff = resolved.staff;
    const existing = getTeamProfileSync(staff.teamMemberId);
    await upsertTeamProfile({
      id: staff.teamMemberId,
      name: staff.displayName,
      email: staff.email,
      initials: initialsFromName(staff.displayName),
      role: staff.role,
      title: existing?.title || roleDefaultTitle(staff.role),
      department: existing?.department || roleToDepartment(staff.role),
      commissionPlanId: existing?.commissionPlanId ?? null,
      goals: existing?.goals ?? [],
      availability: existing?.availability ?? "available",
      territory: existing?.territory ?? null,
      active: true,
      joinedAt: existing?.joinedAt ?? staff.createdAt,
    });
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    jar.delete(IMPERSONATE_COOKIE);
    await clearLegacyCookies(jar);
    redirect(next);
  }

  const cred = getCredentialByEmailSync(email);
  if (!cred || !verifyPassword(password, cred.passwordHash)) {
    return { error: "Invalid email or password." };
  }

  const member = getTeamProfileSync(cred.memberId);
  if (!member || !member.active) {
    return { error: "This account is inactive. Contact an owner." };
  }

  const session = await createSession(member.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, {
    ...cookieBase(),
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  });
  jar.delete(IMPERSONATE_COOKIE);
  await clearLegacyCookies(jar);

  redirect(next);
}

export async function logoutAction() {
  const jar = await cookies();
  if (isSupabaseStaffAuthEnabled()) {
    try {
      const { createWorkspaceAuthClient } = await import("@/lib/supabase/server");
      const supabase = await createWorkspaceAuthClient();
      await supabase.auth.signOut();
    } catch {
      /* still clear local cookies */
    }
  }
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) await deleteSession(sid);
  jar.delete(SESSION_COOKIE);
  jar.delete(IMPERSONATE_COOKIE);
  await clearLegacyCookies(jar);
  redirect("/login");
}

export async function requestPasswordResetAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  if (!isSupabaseStaffAuthEnabled()) {
    return { error: "Password reset requires Supabase staff auth." };
  }
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Email is required." };

  // Always return ok to avoid account enumeration; only send if ACL member exists.
  const staff = await getStaffAclRepository().getByEmail(email);
  if (staff?.active) {
    const { createWorkspaceAdminClient } = await import("@/lib/supabase/server");
    const { htcEmailLogoHeaderHtml } = await import("@shared/brand/logo");
    const admin = createWorkspaceAdminClient();
    const redirectTo = `${workspaceBaseUrl()}/login/reset`;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    const actionLink = data?.properties?.action_link;
    if (!error && actionLink) {
      const safe = actionLink
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
      await sendRawEmail({
        to: email,
        subject: "Reset your Hello to Cheers password",
        text: `Reset your Hello to Cheers password:\n\n${actionLink}\n\nIf you did not request this, you can ignore this email.`,
        html: `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f4f1ec;padding:32px">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #ddd6cc;padding:32px">
            ${htcEmailLogoHeaderHtml({ href: "https://hellotocheers.com", widthPx: 180 })}
            <h1 style="color:#1f2a1f;font-size:24px">Reset your password</h1>
            <p style="color:#374151;font-family:-apple-system,sans-serif;font-size:15px;line-height:1.6">
              Use the button below to choose a new password for the Relationship Workspace.
            </p>
            <p><a href="${safe}" style="display:inline-block;background:#5d6f5d;color:#fff;padding:14px 26px;border-radius:6px;text-decoration:none;font-family:-apple-system,sans-serif;font-weight:600">Reset password</a></p>
            <p style="color:#6b7280;font-size:12px;word-break:break-all">${safe}</p>
          </div></body></html>`,
        category: "password_recovery",
        tags: [
          { name: "category", value: "password_recovery" },
          { name: "audience", value: "workspace" },
        ],
      });
    }
  }
  return { ok: true };
}

export async function updatePasswordAfterWorkspaceRecoveryAction(
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  if (!isSupabaseStaffAuthEnabled()) {
    return { error: "Password reset requires Supabase staff auth." };
  }
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (!password || !confirm) {
    return { error: "Enter and confirm your new password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  const { createWorkspaceAuthClient } = await import("@/lib/supabase/server");
  const supabase = await createWorkspaceAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }
  await supabase.auth.signOut();
  return { ok: true };
}

export async function inviteTeamMemberAction(
  _prev: { error?: string; ok?: boolean; inviteUrl?: string } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; inviteUrl?: string }> {
  await ensureProgram4Data();
  const sessionMember = await getSessionMember();
  if (!sessionMember) {
    return { error: "You must be signed in to invite teammates." };
  }
  if (!(await actorCan("manage_team"))) {
    return { error: "Only Owner or Administrator can invite teammates." };
  }

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const role = String(formData.get("role") || "viewer") as TeamRole;

  if (!email || !name) {
    return { error: "Name and email are required." };
  }
  if (!TEAM_ROLES.includes(role)) {
    return { error: "Invalid role." };
  }

  if (isSupabaseStaffAuthEnabled()) {
    const { createWorkspaceAuthClient } = await import("@/lib/supabase/server");
    const supabase = await createWorkspaceAuthClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return { error: "You must be signed in to invite teammates." };

    const created = await createStaffInvite({
      email,
      displayName: name,
      role,
      invitedByUserId: data.user.id,
    });
    if (!created.ok) return { error: created.error };

    // Mirror inactive roster row for UI.
    await upsertTeamProfile({
      id: created.invite.teamMemberId!,
      name,
      email,
      initials: initialsFromName(name),
      role,
      title: roleDefaultTitle(role),
      department: roleToDepartment(role),
      commissionPlanId: null,
      goals: [],
      availability: "available",
      territory: null,
      active: false,
      joinedAt: new Date().toISOString(),
    });

    const acceptUrl = `${workspaceBaseUrl()}/invite/${encodeURIComponent(created.token)}`;
    await sendRawEmail({
      to: email,
      category: "account_invite",
      priority: "critical",
      subject: `You're invited to Hello to Cheers Relationship Workspace`,
      text: [
        `Hi ${name},`,
        ``,
        `${sessionMember.name} invited you to the Hello to Cheers Relationship Workspace as ${ROLE_LABELS[role]}.`,
        ``,
        `Accept your invite and create a password:`,
        acceptUrl,
      ].join("\n"),
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p><strong>${escapeHtml(sessionMember.name)}</strong> invited you as <strong>${escapeHtml(ROLE_LABELS[role])}</strong>.</p>
        <p><a href="${acceptUrl}">Accept invite &amp; create password</a></p>
      `,
      tags: [{ name: "category", value: "team_invite" }],
    });

    revalidatePath("/team");
    revalidatePath("/settings");
    return { ok: true, inviteUrl: acceptUrl };
  }

  const existing = getTeamProfilesSync().find((m) => m.email.toLowerCase() === email);
  let memberId = existing?.id ?? null;

  if (!existing) {
    const created: TeamMemberProfile = {
      id: newProgram4Id("tm"),
      name,
      email,
      initials: initialsFromName(name),
      role,
      title: roleDefaultTitle(role),
      department: roleToDepartment(role),
      commissionPlanId: null,
      goals: [],
      availability: "available",
      territory: null,
      active: false,
      joinedAt: new Date().toISOString(),
    };
    await upsertTeamProfile(created);
    memberId = created.id;
  } else {
    await upsertTeamProfile({
      ...existing,
      name: name || existing.name,
      role,
      title: existing.title || roleDefaultTitle(role),
      department: roleToDepartment(role),
    });
  }

  for (const inv of getPendingInvitesSync()) {
    if (inv.email === email) {
      await upsertInvite({ ...inv, status: "revoked" });
    }
  }

  const token = newInviteToken();
  const invite: TeamInvite = {
    id: newProgram4Id("inv"),
    token,
    email,
    name,
    role,
    memberId,
    invitedById: sessionMember.id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await upsertInvite(invite);

  const acceptUrl = inviteAcceptUrl(token);
  const inviterName = sessionMember.name;

  await sendRawEmail({
    to: email,
    category: "account_invite",
    priority: "critical",
    subject: `You're invited to Hello to Cheers Relationship Workspace`,
    text: [
      `Hi ${name},`,
      ``,
      `${inviterName} invited you to the Hello to Cheers Relationship Workspace as ${ROLE_LABELS[role]}.`,
      ``,
      `Accept your invite and create a password:`,
      acceptUrl,
      ``,
      `If you weren't expecting this, you can ignore this email.`,
    ].join("\n"),
    html: `
      <p>Hi ${escapeHtml(name)},</p>
      <p><strong>${escapeHtml(inviterName)}</strong> invited you to the Hello to Cheers Relationship Workspace as <strong>${escapeHtml(ROLE_LABELS[role])}</strong>.</p>
      <p><a href="${acceptUrl}">Accept invite &amp; create password</a></p>
      <p style="color:#666;font-size:13px">Or paste this link: ${acceptUrl}</p>
    `,
    tags: [{ name: "category", value: "team_invite" }],
  });

  revalidatePath("/team");
  revalidatePath("/settings");
  return { ok: true, inviteUrl: acceptUrl };
}

export async function acceptInviteAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  await ensureProgram4Data();

  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
  }

  if (isSupabaseStaffAuthEnabled()) {
    const { createWorkspaceAdminClient } = await import("@/lib/supabase/server");
    const admin = createWorkspaceAdminClient();
    const repo = getStaffAclRepository();
    const { hashInviteToken } = await import("@/lib/program4/staff-acl");
    const invite = await repo.getInviteByTokenHash(hashInviteToken(token));
    if (!invite || invite.status !== "pending") {
      return { error: "This invite is invalid or has already been used." };
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        htc_workspace_invite: true,
        display_name: invite.displayName,
      },
    });
    if (error || !created.user) {
      // User may already exist — try update password only if email matches pending invite path via sign-in later
      return {
        error:
          error?.message?.includes("already")
            ? "An account with this email already exists. Sign in, then contact an owner."
            : "Could not create account. Try again or contact an owner.",
      };
    }

    const accepted = await acceptStaffInvite({
      token,
      userId: created.user.id,
      email: invite.email,
    });
    if (!accepted.ok) {
      return { error: accepted.error };
    }

    await upsertTeamProfile({
      id: accepted.staff.teamMemberId,
      name: accepted.staff.displayName,
      email: accepted.staff.email,
      initials: initialsFromName(accepted.staff.displayName),
      role: accepted.staff.role,
      title: roleDefaultTitle(accepted.staff.role),
      department: roleToDepartment(accepted.staff.role),
      commissionPlanId: null,
      goals: [],
      availability: "available",
      territory: null,
      active: true,
      joinedAt: accepted.staff.createdAt,
    });

    redirect("/login?accepted=1");
  }

  const invite = getInviteByTokenSync(token);
  if (!invite || invite.status !== "pending") {
    return { error: "This invite is invalid or has already been used." };
  }

  let member =
    (invite.memberId ? getTeamProfileSync(invite.memberId) : undefined) ??
    getTeamProfilesSync().find((m) => m.email.toLowerCase() === invite.email);

  if (!member) {
    member = {
      id: newProgram4Id("tm"),
      name: invite.name,
      email: invite.email,
      initials: initialsFromName(invite.name),
      role: invite.role,
      title: roleDefaultTitle(invite.role),
      department: roleToDepartment(invite.role),
      commissionPlanId: null,
      goals: [],
      availability: "available",
      territory: null,
      active: true,
      joinedAt: new Date().toISOString(),
    };
  } else {
    member = {
      ...member,
      name: invite.name || member.name,
      email: invite.email,
      role: invite.role,
      active: true,
      department: roleToDepartment(invite.role),
    };
  }

  await upsertTeamProfile(member);

  const now = new Date().toISOString();
  await upsertCredential({
    memberId: member.id,
    email: member.email.toLowerCase(),
    passwordHash: hashPassword(password),
    acceptedAt: now,
    updatedAt: now,
  });

  await upsertInvite({
    ...invite,
    memberId: member.id,
    status: "accepted",
    acceptedAt: now,
  });

  redirect("/login?accepted=1");
}

export async function startImpersonateAction(formData: FormData) {
  await ensureProgram4Data();
  const sessionMember = await getSessionMember();
  if (!sessionMember || !roleCanImpersonate(sessionMember.role)) {
    return;
  }

  const targetId = String(formData.get("memberId") || "").trim();
  if (!targetId || targetId === sessionMember.id) return;

  if (isSupabaseStaffAuthEnabled()) {
    const acl = await getStaffAclRepository().getByTeamMemberId(targetId);
    if (!acl?.active && !getTeamProfileSync(targetId)?.active) return;
  } else if (!getTeamProfileSync(targetId)) {
    return;
  }

  const jar = await cookies();
  jar.set(IMPERSONATE_COOKIE, targetId, cookieBase());
  revalidatePath("/", "layout");
}

export async function endImpersonateAction() {
  const jar = await cookies();
  jar.delete(IMPERSONATE_COOKIE);
  revalidatePath("/", "layout");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
