/**
 * Destinations Setup Hub stages and Help links send people to.
 *
 * Ready to invite couples is a Setup Hub declaration, not a workspace wall.
 * Operational routes (Dashboard, Calendar, Leads, Tours, …) remain reachable
 * whether or not the venue has declared readiness. This list is documentation
 * of Setup destinations, not an access allow-list.
 */

const SETUP_DESTINATION_PREFIXES = [
  "/setup-hub",
  "/settings",
  "/library",
  "/help",
  "/onboarding",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * True when this path is a Setup Hub / settings / help / onboarding destination.
 * Empty / missing pathname is not a setup destination.
 */
export function isPreGraduationAllowedPath(pathname: string): boolean {
  const path = pathname.trim();
  if (!path.startsWith("/")) return false;
  const bare = path.split("?", 1)[0].split("#", 1)[0] ?? path;
  return SETUP_DESTINATION_PREFIXES.some((prefix) => matchesPrefix(bare, prefix));
}
