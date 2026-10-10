/**
 * Preference cookie for the vendor portal lightweight venue switcher.
 * Convenience only — never authorization. The get_vendor_active_venue RPC
 * still validates the vendor owns an active relationship with the venue.
 */
import { cookies } from "next/headers";

export const VENDOR_ACTIVE_VENUE_COOKIE = "htc_vendor_active_venue_id";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

function isCookieMutationForbidden(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Cookies can only be modified");
}

export async function readVendorActiveVenueCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(VENDOR_ACTIVE_VENUE_COOKIE)?.value?.trim();
  return value || null;
}

export async function writeVendorActiveVenueCookie(venueId: string): Promise<void> {
  try {
    const jar = await cookies();
    jar.set(VENDOR_ACTIVE_VENUE_COOKIE, venueId, COOKIE_OPTS);
  } catch (err) {
    if (isCookieMutationForbidden(err)) return;
    throw err;
  }
}

export async function clearVendorActiveVenueCookie(): Promise<void> {
  try {
    const jar = await cookies();
    jar.delete(VENDOR_ACTIVE_VENUE_COOKIE);
  } catch (err) {
    if (isCookieMutationForbidden(err)) return;
    throw err;
  }
}
