/**
 * Canonical Client list buckets.
 *
 * All Bookings is the active working population (booked, not cancelled, not past).
 * Coming up is a date subset of that population (today through the next 30 days).
 * Needs Attention is an action subset of that population and can overlap Coming up.
 * Cancelled and Past are historical views, opened only by those buckets.
 * They are not five mutually exclusive lifecycle states.
 */
export type ClientListFilterKey =
  | "all"
  | "coming_up"
  | "needs_attention"
  | "cancelled"
  | "past";

export const CLIENT_LIST_FILTERS: { key: ClientListFilterKey; label: string }[] = [
  { key: "all", label: "All Bookings" },
  { key: "coming_up", label: "Coming up" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "cancelled", label: "Cancelled" },
  { key: "past", label: "Past" },
];

/** Coming up is today through the next 30 calendar days, inclusive. */
export const COMING_UP_HORIZON_DAYS = 30;

const FILTER_KEYS = new Set<string>(CLIENT_LIST_FILTERS.map((f) => f.key));

/** Old Client-list URLs and saved chips. They are not buckets anymore. */
const LEGACY_FILTERS: Record<string, ClientListFilterKey> = {
  upcoming: "all",
  wedding_week: "coming_up",
  booked_business: "all",
};

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
  /** Inclusive end of Coming up (today + COMING_UP_HORIZON_DAYS), YYYY-MM-DD. */
  comingUpOut: string;
  attentionClientIds: ReadonlySet<string>;
  /**
   * Client IDs with `events.booked_at` set and the event not cancelled.
   * When present, All Bookings / Coming up / Needs Attention / Past are
   * drawn from this set. Cancelled is status, because cancellation removes
   * the id from this set while keeping the relationship.
   */
  bookedClientIds?: ReadonlySet<string>;
};

/** Inclusive end of Coming up (today + 30 calendar days). */
export function comingUpHorizonEnd(today: string): string {
  return addDaysIso(today, COMING_UP_HORIZON_DAYS);
}

function addDaysIso(today: string, days: number): string {
  return new Date(new Date(today + "T00:00:00Z").getTime() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function parseClientListFilter(value: string | null | undefined): ClientListFilterKey | null {
  if (!value) return null;
  if (LEGACY_FILTERS[value]) return LEGACY_FILTERS[value];
  if (!FILTER_KEYS.has(value)) return null;
  return value as ClientListFilterKey;
}

export function clientListFilterHref(key: ClientListFilterKey): string {
  return `/clients?filter=${key}`;
}

function isBookedClient(client: ClientListFilterRecord, ctx: ClientListFilterContext): boolean {
  if (client.status === "cancelled") return false;
  if (ctx.bookedClientIds) return ctx.bookedClientIds.has(client.id);
  return true;
}

function isPastBooking(client: ClientListFilterRecord, ctx: ClientListFilterContext): boolean {
  return isBookedClient(client, ctx) && !!client.eventDate && client.eventDate < ctx.today;
}

/** Active working population: booked, not cancelled, and not a past event date. */
function isAllBooking(client: ClientListFilterRecord, ctx: ClientListFilterContext): boolean {
  return isBookedClient(client, ctx) && !isPastBooking(client, ctx);
}

export function clientMatchesListFilter(
  client: ClientListFilterRecord,
  key: ClientListFilterKey,
  ctx: ClientListFilterContext,
): boolean {
  switch (key) {
    case "all":
      return isAllBooking(client, ctx);
    case "coming_up":
      return (
        isAllBooking(client, ctx)
        && !!client.eventDate
        && client.eventDate >= ctx.today
        && client.eventDate <= ctx.comingUpOut
      );
    case "needs_attention":
      return isAllBooking(client, ctx) && ctx.attentionClientIds.has(client.id);
    case "past":
      return isPastBooking(client, ctx);
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
