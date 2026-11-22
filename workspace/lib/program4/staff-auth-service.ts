/**
 * Durable Workspace staff authentication operations (R1A).
 * Uses Supabase Auth + htc_internal_staff ACL. Never trusts email domain alone.
 */

import { randomUUID } from "node:crypto";

import {
  getStaffAclRepository,
  hashInviteToken,
  newInviteToken,
  newTeamMemberId,
  type InternalStaffInvite,
  type InternalStaffRecord,
} from "./staff-acl";
import type { TeamRole } from "./types";
import { getWorkspaceAuthProvider } from "@/lib/supabase/workspace-auth-config";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export type AuthResult =
  | { ok: true; userId: string; staff: InternalStaffRecord }
  | { ok: false; error: string; code: "invalid" | "inactive" | "not_staff" | "config" };

export async function resolveStaffAfterAuth(userId: string, email: string | null): Promise<AuthResult> {
  const staff = await getStaffAclRepository().getByUserId(userId);
  if (!staff) {
    return { ok: false, error: "This account is not authorized for Workspace.", code: "not_staff" };
  }
  if (!staff.active) {
    return { ok: false, error: "This account is inactive. Contact an owner.", code: "inactive" };
  }
  if (email && staff.email !== email.trim().toLowerCase()) {
    // Do not silently rebind identities on email mismatch.
    return { ok: false, error: "Staff identity mismatch. Contact an owner.", code: "not_staff" };
  }
  return { ok: true, userId, staff };
}

/**
 * One-time first Owner ACL bind.
 * Links an existing or newly created auth.users id — never elevates venue roles.
 * Optional WORKSPACE_BOOTSTRAP_OWNER_EMAIL must match when set.
 */
export async function bootstrapFirstOwner(input: {
  userId: string;
  email: string;
  displayName: string;
  bootstrapSecret: string;
  /** Prefer existing Program4 team member id when known (e.g. tm_jen). */
  teamMemberId?: string | null;
}): Promise<AuthResult> {
  const expected = process.env.WORKSPACE_BOOTSTRAP_SECRET?.trim() || "";
  if (!expected || input.bootstrapSecret !== expected) {
    return { ok: false, error: "Bootstrap unauthorized.", code: "config" };
  }
  const email = input.email.trim().toLowerCase();
  const approved = (process.env.WORKSPACE_BOOTSTRAP_OWNER_EMAIL || "")
    .trim()
    .toLowerCase();
  if (approved && email !== approved) {
    return {
      ok: false,
      error: "Bootstrap email is not the founder-approved Owner identity.",
      code: "config",
    };
  }
  const repo = getStaffAclRepository();
  const owners = await repo.countActiveOwners();
  if (owners > 0) {
    return { ok: false, error: "Bootstrap already completed.", code: "config" };
  }
  const existingByUser = await repo.getByUserId(input.userId);
  if (existingByUser?.active) {
    return { ok: false, error: "Bootstrap already completed.", code: "config" };
  }
  const now = new Date().toISOString();
  const staff = await repo.upsertStaff({
    userId: input.userId,
    teamMemberId: input.teamMemberId?.trim() || newTeamMemberId(),
    email,
    displayName: input.displayName.trim() || email,
    role: "owner",
    active: true,
    createdAt: now,
    updatedAt: now,
    deactivatedAt: null,
    createdBy: null,
  });
  await repo.appendAudit({
    actorUserId: input.userId,
    action: "bootstrap_owner",
    targetUserId: input.userId,
    targetEmail: staff.email,
    detail: { linkedExistingAuthUser: true },
  });
  return { ok: true, userId: input.userId, staff };
}

export async function createStaffInvite(input: {
  email: string;
  displayName: string;
  role: TeamRole;
  invitedByUserId: string;
  teamMemberId?: string | null;
}): Promise<{ ok: true; token: string; invite: InternalStaffInvite } | { ok: false; error: string }> {
  const repo = getStaffAclRepository();
  const inviter = await repo.getByUserId(input.invitedByUserId);
  if (!inviter || !inviter.active) {
    return { ok: false, error: "You must be an active staff member to invite." };
  }
  if (inviter.role !== "owner" && inviter.role !== "administrator") {
    return { ok: false, error: "Only Owner or Administrator can invite teammates." };
  }

  const email = input.email.trim().toLowerCase();
  const existing = await repo.getByEmail(email);
  if (existing?.active) {
    return { ok: false, error: "That email already has an active staff account." };
  }

  const token = newInviteToken();
  const now = Date.now();
  const invite: InternalStaffInvite = {
    id: randomUUID(),
    tokenHash: hashInviteToken(token),
    email,
    displayName: input.displayName.trim(),
    role: input.role,
    teamMemberId: input.teamMemberId ?? existing?.teamMemberId ?? newTeamMemberId(),
    invitedBy: input.invitedByUserId,
    status: "pending",
    expiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
    createdAt: new Date(now).toISOString(),
    acceptedAt: null,
    acceptedUserId: null,
  };
  await repo.createInvite(invite);
  await repo.appendAudit({
    actorUserId: input.invitedByUserId,
    action: "invite_create",
    targetEmail: email,
    detail: { role: input.role, inviteId: invite.id },
  });
  return { ok: true, token, invite };
}

export async function acceptStaffInvite(input: {
  token: string;
  userId: string;
  email: string;
}): Promise<AuthResult> {
  const repo = getStaffAclRepository();
  const invite = await repo.getInviteByTokenHash(hashInviteToken(input.token));
  if (!invite || invite.status !== "pending") {
    return { ok: false, error: "This invite is invalid or has already been used.", code: "invalid" };
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    await repo.updateInvite({ ...invite, status: "expired" });
    return { ok: false, error: "This invite has expired.", code: "invalid" };
  }
  const email = input.email.trim().toLowerCase();
  if (email !== invite.email) {
    return {
      ok: false,
      error: "Sign in with the invited email address to accept.",
      code: "not_staff",
    };
  }

  const now = new Date().toISOString();
  const staff = await repo.upsertStaff({
    userId: input.userId,
    teamMemberId: invite.teamMemberId ?? newTeamMemberId(),
    email,
    displayName: invite.displayName,
    role: invite.role,
    active: true,
    createdAt: now,
    updatedAt: now,
    deactivatedAt: null,
    createdBy: invite.invitedBy,
  });
  await repo.updateInvite({
    ...invite,
    status: "accepted",
    acceptedAt: now,
    acceptedUserId: input.userId,
    teamMemberId: staff.teamMemberId,
  });
  await repo.appendAudit({
    actorUserId: input.userId,
    action: "invite_accept",
    targetUserId: input.userId,
    targetEmail: email,
    detail: { role: invite.role },
  });
  return { ok: true, userId: input.userId, staff };
}

export async function deactivateStaff(input: {
  targetUserId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const repo = getStaffAclRepository();
  const actor = await repo.getByUserId(input.actorUserId);
  if (!actor || !actor.active || (actor.role !== "owner" && actor.role !== "administrator")) {
    return { ok: false, error: "Forbidden." };
  }
  if (input.targetUserId === input.actorUserId) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }
  const target = await repo.getByUserId(input.targetUserId);
  if (!target) return { ok: false, error: "Staff member not found." };
  if (target.role === "owner" && actor.role !== "owner") {
    return { ok: false, error: "Only an Owner can deactivate another Owner." };
  }
  await repo.deactivate(input.targetUserId, input.actorUserId);
  return { ok: true };
}

export function staffAuthProviderLabel(): string {
  return getWorkspaceAuthProvider();
}
