/**
 * Browser sessionStorage accessors for Leads list working context.
 * Client-only — import from Client Components.
 */

import {
  LEADS_LIST_SESSION_KEY,
  buildLeadsListSession,
  parseLeadsListSession,
  serializeLeadsListSession,
  type LeadsListSessionV1,
} from "@/lib/leads/list-session";

export function readLeadsListSession(): LeadsListSessionV1 | null {
  if (typeof window === "undefined") return null;
  try {
    return parseLeadsListSession(window.sessionStorage.getItem(LEADS_LIST_SESSION_KEY));
  } catch {
    return null;
  }
}

export function writeLeadsListSession(session: LeadsListSessionV1): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LEADS_LIST_SESSION_KEY, serializeLeadsListSession(session));
  } catch {
    // Quota / private mode — working context is best-effort.
  }
}

export function clearLeadsListSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LEADS_LIST_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function saveLeadsListWorkingContext(args: {
  href: string;
  fingerprint: string;
  leadIds: readonly string[];
  scrollY: number;
}): void {
  writeLeadsListSession(
    buildLeadsListSession({
      href: args.href,
      fingerprint: args.fingerprint,
      leadIds: args.leadIds,
      scrollY: args.scrollY,
    }),
  );
}
