/**
 * Resolve which Event a Client workspace should show.
 *
 * Honor ?eventId= only when that Event belongs to this Client. Invalid or
 * unauthorized IDs fall back to the Client's linked Event and never expose
 * another Client's or venue's record.
 */
export function resolveClientWorkspaceEventId(
  events: readonly { id: string }[],
  requestedEventId: string | null | undefined,
  fallbackEventId: string | null,
): string | null {
  const requested = requestedEventId?.trim() ?? "";
  if (requested && events.some((event) => event.id === requested)) return requested;
  return fallbackEventId;
}

/** Client workspace URL that keeps the Event being viewed. */
export function clientWorkspaceHref(clientId: string, eventId?: string | null): string {
  return eventId ? `/clients/${clientId}?eventId=${eventId}` : `/clients/${clientId}`;
}
