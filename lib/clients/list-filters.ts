/**
 * Canonical Client list filters — the same population for Clients pills
 * and any Dashboard metric that navigates into those views.
 *
 * Definitions live here once. Do not re-implement "Upcoming" (or the
 * other operational views) in dashboard-specific query code.
 */
export type ClientListFilterKey =
  | "all"
  | "upcoming"
  | "wedding_week"
  | "needs_attention"
  | "past"
  | "cancelled";

export const CLIENT_LIST_FILTERS: { key: ClientListFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "wedding_week", label: "Wedding Week" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

const FILTER_KEYS = new Set<string>(CLIENT_LIST_FILTERS.map((f) => f.key));

/** Minimum client shape the operational views need — Clients rows or dashboard client rows. */
export type ClientListFilterRecord = {
  id: string;
  status: string;
  eventDate: string | null;
};

export type ClientListFilterContext = {
  /** Venue-local calendar day, YYYY-MM-DD. */
  today: string;
  /** Inclusive end of Wedding Week (today + 7 days), YYYY-MM-DD. */
  weekOut: string;
  attentionClientIds: ReadonlySet<string>;
};

/**
 * Inclusive end of the Wedding Week window. Same calendar-day arithmetic
 * the Clients list has always used: today + 7 days in UTC date space
 * (event dates are date-only strings, not timestamps).
 */
export function weddingWeekEnd(today: string): string {
  return new Date(new Date(today + "T00:00:00Z").getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function parseClientListFilter(value: string | null | undefined): ClientListFilterKey | null {
  if (!value || !FILTER_KEYS.has(value)) return null;
  return value as ClientListFilterKey;
}

export function clientListFilterHref(key: ClientListFilterKey): string {
  return `/clients?filter=${key}`;
}

/**
 * Upcoming = booked client with an event date on or after today, not cancelled.
 * Planning / Confirmed / Complete / any non-cancelled status all count.
 * There is no extra "confirmed only" or "next 60 days" requirement.
 */
export function clientMatchesListFilter(
  client: ClientListFilterRecord,
  key: ClientListFilterKey,
  ctx: ClientListFilterContext,
): boolean {
  switch (key) {
    case "all":
      return client.status !== "cancelled";
    case "upcoming":
      return client.status !== "cancelled" && !!client.eventDate && client.eventDate >= ctx.today;
    case "wedding_week":
      return (
        client.status !== "cancelled" &&
        !!client.eventDate &&
        client.eventDate >= ctx.today &&
        client.eventDate <= ctx.weekOut
      );
    case "needs_attention":
      return client.status !== "cancelled" && ctx.attentionClientIds.has(client.id);
    case "past":
      return client.status !== "cancelled" && !!client.eventDate && client.eventDate < ctx.today;
    case "cancelled":
      return client.status === "cancelled";
  }
}

export function countClientListFilters(
  clients: ClientListFilterRecord[],
  ctx: ClientListFilterContext,
): Record<ClientListFilterKey, number> {
  const counts = {} as Record<ClientListFilterKey, number>;
  for (const { key } of CLIENT_LIST_FILTERS) {
    counts[key] = clients.filter((c) => clientMatchesListFilter(c, key, ctx)).length;
  }
  return counts;
}
