/**
 * Shared Welcome auth-scope resolution (WP4 + vendor cookie jars).
 *
 * Pure helpers — no DB. Callers supply which sessions are present and
 * routing signals (returnTo). Query `context` alone never selects vendor
 * scope (spoof protection).
 */

import type { AuthSessionScope } from "@/lib/auth/session-scope";
import {
  isWelcomeFlowContext,
  safeReturnToPath,
  type WelcomeFlowContext,
} from "@/lib/legal/welcome-integration";

export type WelcomeAuthScope = Extract<AuthSessionScope, "venue" | "vendor">;

export const VENDOR_WELCOME_FALLBACK = "/vendor/dashboard";
export const VENUE_WELCOME_FALLBACK = "/dashboard";

/** True for the shared Welcome Experience path. */
export function isWelcomeAppPath(pathname: string): boolean {
  return pathname === "/welcome" || pathname.startsWith("/welcome/");
}

/** Whether a relative return path is a vendor-portal destination. */
export function isVendorReturnToPath(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  try {
    const url = new URL(trimmed, "http://local.test");
    const path = url.pathname;
    return path === "/vendor" || path.startsWith("/vendor/");
  } catch {
    return false;
  }
}

/**
 * Deterministic Welcome session scope when venue and/or vendor cookies exist.
 *
 * Rules (in order):
 * 1. returnTo under /vendor/* + live vendor session → vendor
 * 2. vendor session only → vendor
 * 3. venue session only → venue
 * 4. both sessions, returnTo not vendor → venue (no escalation via context)
 * 5. neither → null
 *
 * `context=vendorInvitation` without a vendor session never yields vendor.
 */
export function resolveWelcomeAuthScope(input: {
  hasVenueSession: boolean;
  hasVendorSession: boolean;
  returnTo?: string | null;
}): WelcomeAuthScope | null {
  const vendorReturn = isVendorReturnToPath(input.returnTo);

  if (input.hasVendorSession && vendorReturn) return "vendor";
  if (input.hasVendorSession && !input.hasVenueSession) return "vendor";
  if (input.hasVenueSession && !input.hasVendorSession) return "venue";
  if (input.hasVenueSession && input.hasVendorSession) {
    return vendorReturn ? "vendor" : "venue";
  }
  return null;
}

/**
 * Sanitize returnTo for the resolved Welcome scope.
 * Vendor sessions may only return under /vendor/* (not login/accept).
 */
export function safeWelcomeReturnToPath(
  raw: string | null | undefined,
  scope: WelcomeAuthScope,
  options?: { origin?: string },
): string {
  if (scope === "vendor") {
    const candidate = safeReturnToPath(raw, {
      fallback: VENDOR_WELCOME_FALLBACK,
      origin: options?.origin,
    });
    if (!isVendorReturnToPath(candidate)) return VENDOR_WELCOME_FALLBACK;
    try {
      const url = new URL(candidate, "http://local.test");
      if (
        url.pathname === "/vendor/login" ||
        url.pathname.startsWith("/vendor/login/") ||
        url.pathname === "/vendor/accept" ||
        url.pathname.startsWith("/vendor/accept/")
      ) {
        return VENDOR_WELCOME_FALLBACK;
      }
    } catch {
      return VENDOR_WELCOME_FALLBACK;
    }
    return candidate;
  }

  return safeReturnToPath(raw, {
    fallback: VENUE_WELCOME_FALLBACK,
    origin: options?.origin,
  });
}

/**
 * Honor a caller-supplied Welcome context only when it matches the auth scope.
 * Prevents `?context=vendorInvitation` from labeling venue Welcome as vendor.
 */
export function welcomeContextForScope(
  scope: WelcomeAuthScope,
  contextParam: string | null | undefined,
  inferred: WelcomeFlowContext,
): WelcomeFlowContext {
  if (!isWelcomeFlowContext(contextParam)) return inferred;

  if (scope === "vendor") {
    if (
      contextParam === "vendorInvitation" ||
      contextParam === "versionUpdate"
    ) {
      return contextParam;
    }
    return inferred;
  }

  if (
    contextParam === "venueSignup" ||
    contextParam === "versionUpdate"
  ) {
    return contextParam;
  }
  return inferred;
}

/** Portal query value must match an authenticated session of that scope. */
export function portalMatchesSession(
  portal: "venue" | "vendor",
  sessions: { hasVenueSession: boolean; hasVendorSession: boolean },
): boolean {
  if (portal === "vendor") return sessions.hasVendorSession;
  return sessions.hasVenueSession;
}
