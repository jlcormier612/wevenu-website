import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";

import { getSessionSync } from "./auth-store";
import { roleHasPermission } from "./permissions";
import { requireActiveInternalStaff } from "./staff-acl";
import { getTeamProfileSync } from "./store";
import type { Permission, TeamMemberProfile, TeamRole } from "./types";
import {
  getWorkspaceAuthProvider,
  isSupabaseStaffAuthEnabled,
} from "@/lib/supabase/workspace-auth-config";

/** Opaque legacy JSONL session id → team member (legacy_jsonl only). */
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

function profileFromAcl(staff: {
  teamMemberId: string;
  email: string;
  displayName: string;
  role: TeamRole;
  active: boolean;
  createdAt: string;
}): TeamMemberProfile {
  const existing = getTeamProfileSync(staff.teamMemberId);
  if (existing) {
    return {
      ...existing,
      email: staff.email,
      name: staff.displayName || existing.name,
      role: staff.role,
      active: staff.active,
    };
  }
  const parts = staff.displayName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase()
      : (parts[0] ?? "??").slice(0, 2).toUpperCase();
  return {
    id: staff.teamMemberId,
    name: staff.displayName,
    email: staff.email,
    initials,
    role: staff.role,
    title: staff.role,
    department: "leadership",
    commissionPlanId: null,
    goals: [],
    availability: "available",
    territory: null,
    active: staff.active,
    joinedAt: staff.createdAt,
  };
}

/**
 * Request-scoped staff resolution for Supabase mode.
 * AppShell + pages call getSessionMember / getActingMember / actorCan repeatedly;
 * without dedupe each call hits Auth getUser + ACL (R1B nav latency).
 */
const getSupabaseSessionMember = cache(
  async (): Promise<TeamMemberProfile | null> => {
    if (getWorkspaceAuthProvider() === "memory") {
      // Tests inject auth via AsyncLocal / cookie stub — resolved in auth test harness.
      const { getMemoryAuthUserId } = await import("./staff-auth-memory");
      const userId = getMemoryAuthUserId();
      if (!userId) return null;
      const staff = await requireActiveInternalStaff(userId);
      if (!staff) return null;
      return profileFromAcl(staff);
    }

    const { createWorkspaceAuthClient } = await import("@/lib/supabase/server");
    const supabase = await createWorkspaceAuthClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const staff = await requireActiveInternalStaff(data.user.id);
    if (!staff) return null;
    return profileFromAcl(staff);
  },
);

async function getLegacySessionMember(): Promise<TeamMemberProfile | null> {
  const sid = await getSessionId();
  if (!sid) return null;
  const session = getSessionSync(sid);
  if (!session?.memberId) return null;
  const member = getTeamProfileSync(session.memberId) ?? null;
  if (!member || !member.active) return null;
  return member;
}

/** Real logged-in member (ignores impersonation). */
export async function getSessionMemberId(): Promise<string | null> {
  const member = await getSessionMember();
  return member?.id ?? null;
}

export async function getSessionMember(): Promise<TeamMemberProfile | null> {
  if (isSupabaseStaffAuthEnabled()) {
    return getSupabaseSessionMember();
  }
  return getLegacySessionMember();
}

export async function getImpersonateMemberId(): Promise<string | null> {
  let raw: string | undefined;
  try {
    const jar = await cookies();
    raw = jar.get(IMPERSONATE_COOKIE)?.value?.trim();
  } catch {
    // Unit tests / non-request contexts have no cookie store.
    return null;
  }
  if (!raw) return null;
  if (isSupabaseStaffAuthEnabled()) {
    const acl = await import("./staff-acl");
    const byTeam = await acl.getStaffAclRepository().getByTeamMemberId(raw);
    if (byTeam?.active) return byTeam.teamMemberId;
    // Allow impersonating Program4-only seed profiles still present locally
    if (getTeamProfileSync(raw)?.active) return raw;
    return null;
  }
  if (!getTeamProfileSync(raw)) return null;
  return raw;
}

/**
 * Effective actor for permissions / UI.
 * Session user unless Owner/Admin is impersonating someone.
 *
 * R0/R1A: returns null when unauthenticated — never falls back to a seed Owner.
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

  if (isSupabaseStaffAuthEnabled()) {
    const acl = await import("./staff-acl");
    const staff = await acl.getStaffAclRepository().getByTeamMemberId(id);
    if (staff?.active) return profileFromAcl(staff);
  }

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
