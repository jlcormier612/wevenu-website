/**
 * Wave 1 — client working-context helpers for Leads list return/navigation.
 * Pure + serializable. No PII beyond lead UUIDs already in the URL path.
 */

import { LEADS_PAGE_SIZE } from "@/lib/leads/list-query";

export const LEADS_LIST_SESSION_KEY = "htc.leads.list.session.v1";

/** Discard sessions older than this (ms). */
export const LEADS_LIST_SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Hard ceiling for progressive restore requests (5 × page size).
 * Prevents sessionStorage from triggering unbounded server loads.
 */
export const LEADS_LIST_RESTORE_MAX_ROWS = LEADS_PAGE_SIZE * 5;

export type LeadsListSessionV1 = {
  v: 1;
  /** Full list href including query (`/leads` or `/leads?...`). */
  href: string;
  /** Same fingerprint as progressive load race checks. */
  fingerprint: string;
  /** Progressive window ids in display order. */
  leadIds: string[];
  scrollY: number;
  updatedAt: number;
};

export type LeadsListRestorePhase = "idle" | "pending" | "done";

export function isLeadsListSessionV1(value: unknown): value is LeadsListSessionV1 {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === 1 &&
    typeof v.href === "string" &&
    v.href.startsWith("/leads") &&
    !/^\/leads\/[0-9a-f-]{36}/i.test(v.href) &&
    typeof v.fingerprint === "string" &&
    Array.isArray(v.leadIds) &&
    v.leadIds.every((id) => typeof id === "string") &&
    typeof v.scrollY === "number" &&
    Number.isFinite(v.scrollY) &&
    typeof v.updatedAt === "number"
  );
}

export function parseLeadsListSession(
  raw: string | null | undefined,
  now = Date.now(),
): LeadsListSessionV1 | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isLeadsListSessionV1(parsed)) return null;
    if (now - parsed.updatedAt > LEADS_LIST_SESSION_TTL_MS) return null;
    return {
      ...parsed,
      leadIds: parsed.leadIds.slice(0, LEADS_LIST_RESTORE_MAX_ROWS),
      scrollY: Math.max(0, Math.round(parsed.scrollY)),
    };
  } catch {
    return null;
  }
}

export function serializeLeadsListSession(session: LeadsListSessionV1): string {
  return JSON.stringify({
    ...session,
    leadIds: session.leadIds.slice(0, LEADS_LIST_RESTORE_MAX_ROWS),
  });
}

/** True when pathname is a Lead detail workspace (`/leads/{uuid}`…), not list/new/pipeline. */
export function isLeadDetailPath(pathname: string): boolean {
  return /^\/leads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/|$|\?)/i.test(
    pathname,
  );
}

/**
 * Shell Leads item href:
 * - From Lead Detail → last list working href (filters / progressive context).
 * - Already on `/leads` (any query) → keep current URL (do not reset filters).
 * - Elsewhere → default `/leads` (or attention override passed as defaultHref).
 */
export function leadsShellHrefFromSession(args: {
  pathname: string;
  search?: string;
  defaultHref: string;
  sessionHref: string | null | undefined;
}): string {
  const { pathname, search = "", defaultHref, sessionHref } = args;
  if (isLeadDetailPath(pathname)) {
    if (!sessionHref) return defaultHref;
    if (!sessionHref.startsWith("/leads")) return defaultHref;
    if (isLeadDetailPath(sessionHref)) return defaultHref;
    return sessionHref;
  }
  if (pathname === "/leads" || pathname === "/leads/") {
    const qs = search && !search.startsWith("?") ? `?${search}` : search;
    return `/leads${qs}`;
  }
  return defaultHref;
}

/**
 * Restore progressive rows only when filters match and the server's first
 * page still agrees with the session prefix (guards against concealed creates
 * / stage moves that reshuffled the top of the list).
 */
export function shouldRestoreProgressiveSession(args: {
  session: LeadsListSessionV1;
  urlFingerprint: string;
  serverFirstIds: readonly string[];
  pageSize: number;
}): boolean {
  const { session, urlFingerprint, serverFirstIds, pageSize } = args;
  if (session.fingerprint !== urlFingerprint) return false;
  if (session.leadIds.length <= serverFirstIds.length) return false;
  if (serverFirstIds.length === 0) return false;
  const n = Math.min(pageSize, serverFirstIds.length, session.leadIds.length);
  for (let i = 0; i < n; i++) {
    if (session.leadIds[i] !== serverFirstIds[i]) return false;
  }
  return true;
}

/** Bound restore window size — never below pageSize, never above RESTORE_MAX. */
export function clampLeadsRestoreCount(
  requested: number,
  pageSize: number = LEADS_PAGE_SIZE,
): number {
  if (!Number.isFinite(requested)) return pageSize;
  const n = Math.floor(requested);
  if (n <= pageSize) return pageSize;
  return Math.min(n, LEADS_LIST_RESTORE_MAX_ROWS);
}

export type LeadsListRestorePlan =
  | { action: "use_server_window"; reason: string }
  | { action: "restore"; limit: number; scrollY: number; sessionLeadCount: number };

/**
 * Decide whether to hydrate beyond the authoritative first page.
 * Behavioral scenarios (filter+show-more return, new lead at top, expiry) live here.
 */
export function planLeadsListRestore(args: {
  session: LeadsListSessionV1 | null;
  urlFingerprint: string;
  serverFirstIds: readonly string[];
  pageSize: number;
}): LeadsListRestorePlan {
  const { session, urlFingerprint, serverFirstIds, pageSize } = args;
  if (!session) return { action: "use_server_window", reason: "no_session" };
  if (
    !shouldRestoreProgressiveSession({
      session,
      urlFingerprint,
      serverFirstIds,
      pageSize,
    })
  ) {
    return { action: "use_server_window", reason: "invalidated_or_mismatch" };
  }
  const limit = clampLeadsRestoreCount(session.leadIds.length, pageSize);
  if (limit <= serverFirstIds.length) {
    return { action: "use_server_window", reason: "within_first_page" };
  }
  return {
    action: "restore",
    limit,
    scrollY: session.scrollY,
    sessionLeadCount: session.leadIds.length,
  };
}

/**
 * Gate session writes so a pending restore cannot be clobbered by the
 * initial 20-row mount / scroll effect.
 */
export function shouldPersistLeadsListSession(args: {
  phase: LeadsListRestorePhase;
  force?: boolean;
  existing: LeadsListSessionV1 | null;
  nextLeadIds: readonly string[];
  fingerprint: string;
}): boolean {
  const { phase, force = false, existing, nextLeadIds, fingerprint } = args;
  if (force) return true;
  if (phase === "pending" || phase === "idle") return false;
  if (
    existing &&
    existing.fingerprint === fingerprint &&
    existing.leadIds.length > nextLeadIds.length
  ) {
    // Do not shrink a larger matching session with a smaller snapshot.
    return false;
  }
  return true;
}

/** After a cancelled in-flight restore, keep the prior session untouched. */
export function sessionAfterRestoreCancelled(
  existing: LeadsListSessionV1 | null,
): LeadsListSessionV1 | null {
  return existing;
}

export function buildLeadsListSession(args: {
  href: string;
  fingerprint: string;
  leadIds: readonly string[];
  scrollY: number;
  now?: number;
}): LeadsListSessionV1 {
  return {
    v: 1,
    href: args.href.startsWith("/leads") ? args.href : "/leads",
    fingerprint: args.fingerprint,
    leadIds: [...args.leadIds].slice(0, LEADS_LIST_RESTORE_MAX_ROWS),
    scrollY: Math.max(0, Math.round(args.scrollY)),
    updatedAt: args.now ?? Date.now(),
  };
}
