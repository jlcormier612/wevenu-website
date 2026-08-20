/**
 * Post-auth home resolution for venue / vendor / client portals.
 *
 * Venue, vendor, and client each use a separate Supabase Auth cookie jar so
 * one browser can hold independent sessions. Role resolution still matters
 * within a single jar (e.g. multi-role on one email).
 */

export type PortalRoles = {
  /** Active vendor_users row for this auth user. */
  isVendor: boolean;
  /** First client_portal_sessions access path, e.g. `/p/{token}`. */
  clientPortalPath: string | null;
  /** venue_staff / venue ownership via current_user_venue_id. */
  isVenueStaff: boolean;
};

export type PortalKind = "venue" | "vendor" | "client";

/**
 * Same-origin relative redirect targets only (blocks //evil.com and external URLs).
 */
export function safeInternalNextPath(
  raw: unknown,
  options?: { disallowLogin?: boolean },
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  try {
    const url = new URL(trimmed, "http://localhost");
    if (options?.disallowLogin !== false && url.pathname === "/login") {
      return null;
    }
    // Never bounce through the chooser as a next= loop target.
    if (url.pathname === "/workspaces") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Count how many portal kinds this identity can enter. */
export function countPortalRoles(roles: PortalRoles): number {
  let n = 0;
  if (roles.isVendor) n += 1;
  if (roles.clientPortalPath) n += 1;
  if (roles.isVenueStaff) n += 1;
  return n;
}

/**
 * Pure home picker used by /login redirects and signIn.
 *
 * Priority:
 * 1. Explicit safe `next` (invitation return, deep link)
 * 2. Single available portal → that portal's home
 * 3. Multiple portals → `/workspaces` chooser (never silently pick venue)
 * 4. No portals yet → `/setup` (venue onboarding)
 */
export function pickAuthenticatedHomePath(input: {
  next?: string | null;
  roles: PortalRoles;
  /** When set and the identity has that role, prefer it over the chooser. */
  prefer?: PortalKind | null;
}): string {
  const next = safeInternalNextPath(input.next ?? null);
  if (next) return next;

  const { roles, prefer } = input;
  const available: PortalKind[] = [];
  if (roles.isVendor) available.push("vendor");
  if (roles.clientPortalPath) available.push("client");
  if (roles.isVenueStaff) available.push("venue");

  if (prefer && available.includes(prefer)) {
    return homeForPortal(prefer, roles);
  }

  if (available.length === 1) {
    return homeForPortal(available[0]!, roles);
  }

  if (available.length > 1) {
    return "/workspaces";
  }

  // Authenticated but not linked to any portal yet (new venue signup).
  return "/setup";
}

function homeForPortal(kind: PortalKind, roles: PortalRoles): string {
  switch (kind) {
    case "vendor":
      return "/vendor/dashboard";
    case "client":
      return roles.clientPortalPath ?? "/client/login";
    case "venue":
      return "/dashboard";
  }
}

/**
 * Build `/login?next=` for a protected path the user tried to open while signed out.
 * Skips API routes and paths that are already public auth surfaces.
 */
export function loginRedirectWithNext(pathname: string, search: string): string {
  const candidate = `${pathname}${search || ""}`;
  const safe = safeInternalNextPath(candidate);
  if (!safe) return "/login";
  if (
    safe === "/login" ||
    safe.startsWith("/login?") ||
    safe.startsWith("/client/login") ||
    safe.startsWith("/client/accept") ||
    safe.startsWith("/vendor/accept") ||
    safe.startsWith("/vendor/login") ||
    safe.startsWith("/workspaces") ||
    safe.startsWith("/api/")
  ) {
    return "/login";
  }
  if (safe === "/vendor" || safe.startsWith("/vendor/")) {
    return `/vendor/login?next=${encodeURIComponent(safe)}`;
  }
  return `/login?next=${encodeURIComponent(safe)}`;
}
