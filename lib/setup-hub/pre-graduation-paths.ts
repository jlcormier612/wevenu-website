/**
 * Paths a venue may visit before Ready to Invite Couples.
 *
 * The (app) layout gate still blocks the operational workspace
 * (dashboard, leads, clients, inbox, …). These prefixes are only the
 * destinations Setup Hub stages and Help links actually send people to,
 * so they can configure the venue without bouncing back to /setup-hub.
 *
 * Keep this list narrow: do not add Sales/Clients/Communication routes
 * here unless a Setup Hub stage genuinely requires them.
 */

const ALLOWED_PREFIXES = [
  "/setup-hub",
  "/settings",
  "/library",
  "/help",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * True when a pre-graduation venue may stay on this path.
 * Empty / missing pathname fails closed (caller redirects to Setup Hub).
 */
export function isPreGraduationAllowedPath(pathname: string): boolean {
  const path = pathname.trim();
  if (!path.startsWith("/")) return false;
  // Ignore query/hash if a caller ever passes a full URL path+search.
  const bare = path.split("?", 1)[0].split("#", 1)[0] ?? path;
  return ALLOWED_PREFIXES.some((prefix) => matchesPrefix(bare, prefix));
}
