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
  | "coming_up"
  | "wedding_week"
  | "needs_attention"
  | "past"
  | "cancelled"
  | "booked_business";

export const CLIENT_LIST_FILTERS: { key: ClientListFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "coming_up", label: "Coming up" },
  { key: "wedding_week", label: "Wedding Week" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
  { key: "booked_business", label: "Booked business" },
];

/** Near-term horizon for Dashboard "Coming up" — same 60-day window the
 *  dashboard events query uses (lib/dashboard/service.ts). */
export const COMING_UP_HORIZON_DAYS = 60;

const FILTER_KEYS = new Set<string>(CLIENT_LIST_FILTERS.map((f) => f.key));

/** Minimum client shape the operational views need — Clients rows or dashboard client rows. */
export type ClientListFilterRecord = {
  id: string;
  status: string;
  eventDate: string | null;
  excludeFromBusinessReporting?: boolean;
};

export type ClientListFilterContext = {
  /** Venue-local calendar day, YYYY-MM-DD. */
  today: string;
  /** Inclusive end of Wedding Week (today + 7 days), YYYY-MM-DD. */
  weekOut: string;
  /** Inclusive end of Coming up (today + COMING_UP_HORIZON_DAYS), YYYY-MM-DD. */
  comingUpOut: string;
  attentionClientIds: ReadonlySet<string>;
  /**
   * Client IDs in `canonical_bookings` (financially committed).
   * Required for the Booked business filter / Dashboard Snapshot destination.
   */
  bookedBusinessClientIds?: ReadonlySet<string>;
};

/**
 * Inclusive end of the Wedding Week window. Same calendar-day arithmetic
 * the Clients list has always used: today + 7 days in UTC date space
 * (event dates are date-only strings, not timestamps).
 */
export function weddingWeekEnd(today: string): string {
  return addDaysIso(today, 7);
}

/** Inclusive end of the Dashboard Coming up window (today + 60 days). */
export function comingUpHorizonEnd(today: string): string {
  return addDaysIso(today, COMING_UP_HORIZON_DAYS);
}

function addDaysIso(today: string, days: number): string {
  return new Date(new Date(today + "T00:00:00Z").getTime() + days * 24 * 60 * 60 * 1000)
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
 * When `bookedBusinessClientIds` is provided, it is the only definition of
 * an active client: the relationship has completed the venue's booking
 * transition (`events.booked_at`). Pre-booking shells stay off this list.
 * Cancelled is the only other bucket. Date filters are views of that same
 * booked set, not extra lifecycle stages.
 */
function isActiveBookedClient(
  client: ClientListFilterRecord,
  ctx: ClientListFilterContext,
): boolean {
  if (client.status === "cancelled") return false;
  if (ctx.bookedBusinessClientIds) return ctx.bookedBusinessClientIds.has(client.id);
  return true;
}

export function clientMatchesListFilter(
  client: ClientListFilterRecord,
  key: ClientListFilterKey,
  ctx: ClientListFilterContext,
): boolean {
  switch (key) {
    case "all":
      return isActiveBookedClient(client, ctx);
    case "upcoming":
      return isActiveBookedClient(client, ctx) && !!client.eventDate && client.eventDate >= ctx.today;
    case "coming_up":
      return (
        !client.excludeFromBusinessReporting &&
        isActiveBookedClient(client, ctx) &&
        !!client.eventDate &&
        client.eventDate >= ctx.today &&
        client.eventDate <= ctx.comingUpOut
      );
    case "wedding_week":
      return (
        isActiveBookedClient(client, ctx) &&
        !!client.eventDate &&
        client.eventDate >= ctx.today &&
        client.eventDate <= ctx.weekOut
      );
    case "needs_attention":
      return isActiveBookedClient(client, ctx) && ctx.attentionClientIds.has(client.id);
    case "past":
      return isActiveBookedClient(client, ctx) && !!client.eventDate && client.eventDate < ctx.today;
    case "cancelled":
      return client.status === "cancelled";
    case "booked_business":
      return isActiveBookedClient(client, ctx);
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
