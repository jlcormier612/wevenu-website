import { cookies } from "next/headers";

import {
  getSessionSync,
} from "./auth-store";
import { roleHasPermission } from "./permissions";
import { DEFAULT_ACTOR_ID, getTeamProfileSync, getTeamProfilesSync } from "./store";
import type { Permission, TeamMemberProfile, TeamRole } from "./types";

/** Opaque session id → team member (real login). */
export const SESSION_COOKIE = "ws_session";

/** Owner/Admin temporary support impersonation (HubSpot-style). */
export const IMPERSONATE_COOKIE = "ws_impersonate";

/** @deprecated Project 8 — use SESSION_COOKIE. Kept for cleanup of old cookies. */
export const ACTOR_COOKIE = "ws_actor";

/** @deprecated Project 8 — replaced by SESSION_COOKIE. */
export const AUTH_COOKIE = "ws_auth";

export function roleCanImpersonate(role: TeamRole): boolean {
  return role === "owner" || role === "administrator";
}

export async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value?.trim();
  return raw || null;
}

/** Real logged-in member (ignores impersonation). */
export async function getSessionMemberId(): Promise<string | null> {
  const sid = await getSessionId();
  if (!sid) return null;
  const session = getSessionSync(sid);
  return session?.memberId ?? null;
}

export async function getSessionMember(): Promise<TeamMemberProfile | null> {
  const id = await getSessionMemberId();
  if (!id) return null;
  return getTeamProfileSync(id) ?? null;
}

export async function getImpersonateMemberId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(IMPERSONATE_COOKIE)?.value?.trim();
  if (!raw) return null;
  if (!getTeamProfileSync(raw)) return null;
  return raw;
}

/**
 * Effective actor for permissions / UI.
 * Session user unless Owner/Admin is impersonating someone.
 */
export async function getActingMemberId(): Promise<string> {
  const sessionMember = await getSessionMember();
  if (!sessionMember) {
    return DEFAULT_ACTOR_ID;
  }

  if (roleCanImpersonate(sessionMember.role)) {
    const imp = await getImpersonateMemberId();
    if (imp && imp !== sessionMember.id) {
      return imp;
    }
  }

  return sessionMember.id;
}

export async function getActingMember(): Promise<TeamMemberProfile> {
  const id = await getActingMemberId();
  return getTeamProfileSync(id) ?? getTeamProfilesSync()[0]!;
}

export async function getActingRole(): Promise<TeamRole> {
  const member = await getActingMember();
  return member.role;
}

export async function isImpersonating(): Promise<boolean> {
  const sessionMember = await getSessionMember();
  if (!sessionMember || !roleCanImpersonate(sessionMember.role)) return false;
  const imp = await getImpersonateMemberId();
  return Boolean(imp && imp !== sessionMember.id);
}

export async function actorCan(permission: Permission): Promise<boolean> {
  const role = await getActingRole();
  return roleHasPermission(role, permission);
}

export async function requirePermission(permission: Permission): Promise<boolean> {
  return actorCan(permission);
}
