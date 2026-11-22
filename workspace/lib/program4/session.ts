import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSessionSync } from "./auth-store";
import { roleHasPermission } from "./permissions";
import { getTeamProfileSync } from "./store";
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
  const member = getTeamProfileSync(id) ?? null;
  if (!member || !member.active) return null;
  return member;
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
 *
 * R0: returns null when unauthenticated — never falls back to a seed Owner.
 */
export async function getActingMemberId(): Promise<string | null> {
  const sessionMember = await getSessionMember();
  if (!sessionMember) return null;

  if (roleCanImpersonate(sessionMember.role)) {
    const imp = await getImpersonateMemberId();
    if (imp && imp !== sessionMember.id) {
      return imp;
    }
  }

  return sessionMember.id;
}

export async function getActingMember(): Promise<TeamMemberProfile | null> {
  const id = await getActingMemberId();
  if (!id) return null;
  const member = getTeamProfileSync(id) ?? null;
  if (!member || !member.active) return null;
  return member;
}

export async function getActingRole(): Promise<TeamRole | null> {
  const member = await getActingMember();
  return member?.role ?? null;
}

export async function isImpersonating(): Promise<boolean> {
  const sessionMember = await getSessionMember();
  if (!sessionMember || !roleCanImpersonate(sessionMember.role)) return false;
  const imp = await getImpersonateMemberId();
  return Boolean(imp && imp !== sessionMember.id);
}

/** False when there is no valid staff session (fail closed). */
export async function actorCan(permission: Permission): Promise<boolean> {
  const role = await getActingRole();
  if (!role) return false;
  return roleHasPermission(role, permission);
}

export async function requirePermission(permission: Permission): Promise<boolean> {
  return actorCan(permission);
}

export function unauthorizedJson(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenJson(message = "Forbidden"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export type WorkspaceStaffAuth =
  | { ok: true; session: TeamMemberProfile; actor: TeamMemberProfile }
  | { ok: false; response: NextResponse };

/**
 * Fail-closed staff gate for Workspace API routes and sensitive actions.
 * Requires a valid active session; optional permission checked on the
 * effective (possibly impersonated) actor.
 */
export async function requireWorkspaceStaff(
  permission?: Permission | Permission[],
): Promise<WorkspaceStaffAuth> {
  const session = await getSessionMember();
  if (!session) {
    return { ok: false, response: unauthorizedJson() };
  }

  const actor = await getActingMember();
  if (!actor) {
    return { ok: false, response: unauthorizedJson() };
  }

  if (permission) {
    const needed = Array.isArray(permission) ? permission : [permission];
    const allowed = needed.some((p) => roleHasPermission(actor.role, p));
    if (!allowed) {
      return { ok: false, response: forbiddenJson() };
    }
  }

  return { ok: true, session, actor };
}

/** True when request is HTTPS or production (for Secure cookies). */
export function shouldUseSecureCookies(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const url =
    process.env.WORKSPACE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WORKSPACE_URL?.trim() ||
    "";
  return /^https:\/\//i.test(url);
}
