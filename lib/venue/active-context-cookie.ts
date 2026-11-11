/**
 * Wave 2 — htc_active_venue_id cookie.
 * Convenience only. NEVER authorization. DB context always wins.
 *
 * Cookie mutation is only allowed in Server Actions / Route Handlers.
 * Layout bootstrap still calls sync/clear; those writes must soft-fail so
 * DB-authoritative initialization is never blocked by Next.js cookie rules.
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

function isCookieMutationForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Cookies can only be modified");
}

async function mutateCookie(write: (jar: Awaited<ReturnType<typeof cookies>>) => void): Promise<void> {
  try {
    const jar = await cookies();
    write(jar);
  } catch (err) {
    if (isCookieMutationForbidden(err)) return;
    throw err;
  }
}

export async function readActiveVenueCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACTIVE_VENUE_COOKIE)?.value?.trim();
  return value || null;
}

export async function writeActiveVenueCookie(venueId: string): Promise<void> {
  await mutateCookie((jar) => {
    jar.set(ACTIVE_VENUE_COOKIE, venueId, COOKIE_OPTS);
  });
}

export async function clearActiveVenueCookie(): Promise<void> {
  await mutateCookie((jar) => {
    jar.delete(ACTIVE_VENUE_COOKIE);
  });
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
