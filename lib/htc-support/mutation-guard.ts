/**
 * Stage 1F — server-side mutation gate for HTC support sessions.
 * Read mode: block mutating API methods (except support exit).
 * Assist mode: block customer-only financial / identity / signature paths.
 */

const ALWAYS_BLOCK_PREFIXES = [
  "/api/billing",
  "/api/stripe",
  "/api/payments",
  "/api/connect",
  "/api/contracts/sign",
  "/api/signatures",
  "/api/legal/accept",
  "/api/team/invite",
  "/api/settings/security",
  "/api/settings/password",
  "/api/auth/update-password",
  "/api/account/delete",
];

const EXIT_ALLOW = ["/api/htc-support/exit", "/api/htc-support/enter"];

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

export function supportMutationBlocked(opts: {
  method: string;
  pathname: string;
  mode: string | null | undefined;
}): { blocked: boolean; reason?: string } {
  if (!opts.mode) return { blocked: false };
  if (!isMutatingMethod(opts.method)) return { blocked: false };
  if (EXIT_ALLOW.some((p) => opts.pathname === p || opts.pathname.startsWith(p + "?"))) {
    return { blocked: false };
  }

  if (opts.mode === "read") {
    return { blocked: true, reason: "Support session is read-only" };
  }

  if (opts.mode === "assist") {
    if (
      ALWAYS_BLOCK_PREFIXES.some(
        (p) => opts.pathname === p || opts.pathname.startsWith(`${p}/`),
      )
    ) {
      return {
        blocked: true,
        reason: "This action is customer-only and blocked in assistance mode",
      };
    }
  }

  return { blocked: false };
}
