/**
 * Auth session scopes for Hello to Cheers portals.
 *
 * Venue, vendor, and client each get their own Supabase Auth cookie jar so one
 * browser can hold independent sessions without accept/login replacing another
 * portal's identity. Same email may still link multiple roles on one account;
 * separate scopes also allow three different emails at once.
 */

export type AuthSessionScope = "venue" | "vendor" | "client";

/** Cookie / storage key for a scope. Venue keeps the library default name. */
export function cookieNameForScope(
  scope: AuthSessionScope,
  projectRef: string | null,
): string | undefined {
  if (scope === "venue") {
    // Omit → @supabase/ssr default `sb-<projectRef>-auth-token`.
    return undefined;
  }
  const ref = projectRef?.trim() || "htc";
  if (scope === "vendor") return `sb-${ref}-vendor-auth-token`;
  return `sb-${ref}-client-auth-token`;
}

/** Project ref from a Supabase URL (`https://abcd.supabase.co` → `abcd`). */
export function supabaseProjectRef(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function isVendorAppPath(pathname: string): boolean {
  if (pathname === "/vendor/accept" || pathname.startsWith("/vendor/accept/")) {
    return false;
  }
  if (pathname === "/vendor/login" || pathname.startsWith("/vendor/login/")) {
    return false;
  }
  return pathname === "/vendor" || pathname.startsWith("/vendor/");
}

export function isClientAuthPath(pathname: string): boolean {
  return (
    pathname === "/client/login" ||
    pathname.startsWith("/client/login/") ||
    pathname === "/client/accept" ||
    pathname.startsWith("/client/accept/") ||
    pathname === "/client/accept-participant" ||
    pathname.startsWith("/client/accept-participant/")
  );
}
