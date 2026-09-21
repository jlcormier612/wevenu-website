/**
 * Wave 2 — htc_active_venue_id cookie.
 * Convenience only. NEVER authorization. DB context always wins.
 */
import { cookies } from "next/headers";

import { resolveCookieAfterDbSync } from "@/lib/venue/active-context-logic";

export const ACTIVE_VENUE_COOKIE = "htc_active_venue_id";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function readActiveVenueCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACTIVE_VENUE_COOKIE)?.value?.trim();
  return value || null;
}

export async function writeActiveVenueCookie(venueId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_VENUE_COOKIE, venueId, COOKIE_OPTS);
}

export async function clearActiveVenueCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACTIVE_VENUE_COOKIE);
}

/**
 * Sync cookie to authoritative DB venue id.
 * DB null → clear cookie. Cookie forged/mismatched → rewrite to DB.
 */
export async function syncActiveVenueCookieFromDb(dbVenueId: string | null): Promise<void> {
  const cookie = await readActiveVenueCookie();
  const next = resolveCookieAfterDbSync({ dbVenueId, cookieVenueId: cookie });
  if (next.action === "clear") await clearActiveVenueCookie();
  else if (next.action === "write" && next.cookieVenueId) await writeActiveVenueCookie(next.cookieVenueId);
}
