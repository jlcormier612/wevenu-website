/**
 * Build the Booking Workspace path for a legacy /events/{id} deep link.
 *
 * Server HTTP redirects cannot see or forward URL fragments (#hash). Callers
 * that run in the browser must pass window.location.hash so destinations like
 * /events/{eventId}#documents open Documents on the Booking workspace.
 */
export function bookingWorkspacePathFromEvent(input: {
  clientId: string;
  /** Query string including leading `?`, or empty. */
  search?: string;
  /** Fragment including leading `#`, or empty (e.g. `#documents`). */
  hash?: string;
}): string {
  const search = input.search?.startsWith("?")
    ? input.search
    : input.search
      ? `?${input.search}`
      : "";
  const hash = input.hash?.startsWith("#")
    ? input.hash
    : input.hash
      ? `#${input.hash}`
      : "";
  return `/clients/${input.clientId}${search}${hash}`;
}

export function searchParamsToQueryString(
  sp: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  return qs.size > 0 ? `?${qs.toString()}` : "";
}

/** Calendar and legacy Event links open the matching Client Event. */
export function withEventIdSearch(search: string, eventId: string): string {
  const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  qs.set("eventId", eventId);
  const value = qs.toString();
  return value ? `?${value}` : `?eventId=${eventId}`;
}
