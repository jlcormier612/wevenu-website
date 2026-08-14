/**
 * Legal middleware decision helpers (WP4).
 * Pure path/allowlist logic — DB / engine checks stay in the proxy layer.
 */

import {
  buildWelcomeRedirectPath,
  type WelcomeFlowContext,
  WELCOME_PATH,
} from "@/lib/legal/welcome-integration";

/** Exact public legal landings + active document viewer. */
const PUBLIC_LEGAL_PREFIXES = [
  "/terms",
  "/privacy",
  "/cookies",
  "/acceptable-use",
  "/end-user-terms",
  "/vendor-terms",
  "/legal",
] as const;

/**
 * Authenticated paths that must never redirect into Welcome (loop / freeze
 * prevention). Acceptance APIs must stay reachable.
 */
const LEGAL_ENFORCEMENT_SKIP_PREFIXES = [
  WELCOME_PATH,
  "/login",
  "/auth",
  "/api/legal",
  "/api/portal/legal",
  "/api/auth",
  "/billing/suspended",
  // Public couple / vendor invitation claim surfaces
  "/client/accept",
  "/client/accept-participant",
  "/vendor/accept",
  "/p",
  "/v",
] as const;

export function pathMatchesPrefix(
  pathname: string,
  prefix: string,
): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicLegalPath(pathname: string): boolean {
  return PUBLIC_LEGAL_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix),
  );
}

/**
 * Paths where Legal Middleware must not redirect (Welcome itself, public
 * legal docs, auth callbacks, acceptance APIs, invite claim screens).
 */
export function shouldSkipLegalEnforcement(pathname: string): boolean {
  if (isPublicLegalPath(pathname)) return true;
  return LEGAL_ENFORCEMENT_SKIP_PREFIXES.some((prefix) =>
    pathMatchesPrefix(pathname, prefix),
  );
}

/**
 * API / static navigations where a browser redirect is wrong — return a
 * structured decision so the proxy can 403 JSON instead when desired.
 */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export type LegalMiddlewareDecision =
  | { action: "allow" }
  | {
      action: "redirect_welcome";
      welcomePath: string;
      returnTo: string;
      context: WelcomeFlowContext;
    }
  | {
      action: "block_api";
      returnTo: string;
      context: WelcomeFlowContext;
      welcomePath: string;
    };

/**
 * Decide whether an authenticated request may proceed.
 * Callers supply `requiresAcceptance` from the Legal Acceptance Engine.
 */
export function evaluateLegalMiddleware(input: {
  pathname: string;
  search: string;
  requiresAcceptance: boolean;
  context: WelcomeFlowContext;
  /** When false, never enforce (e.g. Supabase misconfigured). */
  enabled?: boolean;
}): LegalMiddlewareDecision {
  if (input.enabled === false) return { action: "allow" };
  if (!input.requiresAcceptance) return { action: "allow" };
  if (shouldSkipLegalEnforcement(input.pathname)) return { action: "allow" };

  const returnTo = `${input.pathname}${input.search || ""}` || "/dashboard";
  const welcomePath = buildWelcomeRedirectPath({
    returnTo,
    context: input.context,
  });

  if (isApiPath(input.pathname)) {
    return {
      action: "block_api",
      returnTo,
      context: input.context,
      welcomePath,
    };
  }

  return {
    action: "redirect_welcome",
    welcomePath,
    returnTo,
    context: input.context,
  };
}
