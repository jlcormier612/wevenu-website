/**
 * Wave 1 — client working-context helpers for Leads list return/navigation.
 * Pure + serializable. No PII beyond lead UUIDs already in the URL path.
 */

export const LEADS_LIST_SESSION_KEY = "htc.leads.list.session.v1";

/** Discard sessions older than this (ms). */
export const LEADS_LIST_SESSION_TTL_MS = 30 * 60 * 1000;

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

export function parseLeadsListSession(raw: string | null | undefined): LeadsListSessionV1 | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isLeadsListSessionV1(parsed)) return null;
    if (Date.now() - parsed.updatedAt > LEADS_LIST_SESSION_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function serializeLeadsListSession(session: LeadsListSessionV1): string {
  return JSON.stringify(session);
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
    leadIds: [...args.leadIds],
    scrollY: Math.max(0, Math.round(args.scrollY)),
    updatedAt: args.now ?? Date.now(),
  };
}
