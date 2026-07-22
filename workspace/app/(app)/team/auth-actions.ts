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
} from "@/lib/program4/session";
import {
  ensureProgram4Data,
  getTeamProfileSync,
  getTeamProfilesSync,
  newProgram4Id,
  upsertTeamProfile,
} from "@/lib/program4/store";
import type { TeamInvite, TeamMemberProfile, TeamRole } from "@/lib/program4/types";

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

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
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 14,
  });
  jar.delete(IMPERSONATE_COOKIE);
  await clearLegacyCookies(jar);

  redirect(next);
}

export async function logoutAction() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid) await deleteSession(sid);
  jar.delete(SESSION_COOKIE);
  jar.delete(IMPERSONATE_COOKIE);
  await clearLegacyCookies(jar);
  redirect("/login");
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
    // Refresh name/role on re-invite of inactive / seed members without credentials
    await upsertTeamProfile({
      ...existing,
      name: name || existing.name,
      role,
      title: existing.title || roleDefaultTitle(role),
      department: roleToDepartment(role),
    });
  }

  // Revoke prior pending invites for same email
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

  const invite = getInviteByTokenSync(token);
  if (!invite || invite.status !== "pending") {
    return { error: "This invite is invalid or has already been used." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match." };
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
  if (!getTeamProfileSync(targetId)) return;

  const jar = await cookies();
  jar.set(IMPERSONATE_COOKIE, targetId, COOKIE_BASE);
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
