/**
 * Wave 2 — htc_active_venue_id cookie.
 * Convenience only. NEVER authorization. DB context always wins.
 */
import { cookies } from "next/headers";

export const ACTIVE_VENUE_COOKIE = "htc_active_venue_id";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  // Session cookie — cleared on logout / invalid context.
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
  if (!dbVenueId) {
    await clearActiveVenueCookie();
    return;
  }
  const cookie = await readActiveVenueCookie();
  if (cookie !== dbVenueId) {
    await writeActiveVenueCookie(dbVenueId);
  }
}
