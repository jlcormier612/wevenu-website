/**
 * Stock reservations across events (step 6). Pure — no I/O.
 *
 * An event's Event Order reserves stock once the couple approves it; a sent
 * but unapproved order is "pending". Stock 0 means the venue doesn't track
 * that item, so it never warns. Warnings only — nothing is blocked or billed.
 *
 * Mirrors public._inventory_reserved_elsewhere (portal add-table limit).
 */

export type StockSharingMode = "same_day" | "by_time";

export type StockSharingSettings = {
  mode: StockSharingMode;
  /** Gap needed between events that share stock (by_time only). */
  turnaroundMinutes: number;
};

export const DEFAULT_STOCK_SHARING: StockSharingSettings = { mode: "same_day", turnaroundMinutes: 180 };

export type ReservationState = "reserved" | "pending" | "none";

export type StockEvent = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  setupTime?: string | null;
  teardownTime?: string | null;
  state: ReservationState;
  /** Inventory item id → quantity on this event's Event Order. */
  quantities: Record<string, number>;
};

export type StockItem = { id: string; name: string; quantityAvailable: number };

const DAY = 24 * 60;

function dayMinutes(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 60000;
}

function timeMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return h! * 60 + (m ?? 0);
}

/** The span an event holds stock, in minutes. Missing times mean the whole day. */
export function stockWindow(event: StockEvent, mode: StockSharingMode): { start: number; end: number } {
  const startDay = dayMinutes(event.date);
  const endDay = dayMinutes(event.endDate || event.date);
  if (mode === "same_day") return { start: startDay, end: endDay + DAY };
  const t1 = timeMinutes(event.setupTime ?? event.startTime);
  const t2 = timeMinutes(event.teardownTime ?? event.endTime);
  const start = startDay + (t1 ?? 0);
  let end = t2 == null ? endDay + DAY : endDay + t2;
  if (t2 != null && t1 != null && endDay === startDay && t2 <= t1) end += DAY;
  return { start, end };
}

/** True when two events need their own stock (they can't share). */
export function eventsCompete(a: StockEvent, b: StockEvent, settings: StockSharingSettings): boolean {
  const wa = stockWindow(a, settings.mode);
  const wb = stockWindow(b, settings.mode);
  const gap = settings.mode === "by_time" ? Math.max(0, settings.turnaroundMinutes) : 0;
  return wa.start < wb.end + gap && wb.start < wa.end + gap;
}

export type OtherEventUse = { eventId: string; name: string; date: string; quantity: number };

export type EventItemStock = {
  itemId: string;
  name: string;
  owned: number;
  here: number;
  reservedElsewhere: OtherEventUse[];
  pendingElsewhere: OtherEventUse[];
  /** here + approved elsewhere − owned, when positive. Pending is not counted. */
  short: number;
};

/** Stock picture for each tracked item on one event's Event Order. */
export function stockForEvent(
  target: StockEvent, others: StockEvent[], items: StockItem[], settings: StockSharingSettings,
): EventItemStock[] {
  const competing = others.filter((o) => o.id !== target.id && o.state !== "none" && eventsCompete(target, o, settings));
  const out: EventItemStock[] = [];
  for (const item of items) {
    const here = target.quantities[item.id] ?? 0;
    if (here <= 0 || item.quantityAvailable <= 0) continue;
    const usesIn = (state: ReservationState) => competing
      .filter((o) => o.state === state && (o.quantities[item.id] ?? 0) > 0)
      .map((o) => ({ eventId: o.id, name: o.name, date: o.date, quantity: o.quantities[item.id]! }));
    const reservedElsewhere = usesIn("reserved");
    const pendingElsewhere = usesIn("pending");
    const reservedTotal = reservedElsewhere.reduce((s, u) => s + u.quantity, 0);
    out.push({
      itemId: item.id, name: item.name, owned: item.quantityAvailable, here,
      reservedElsewhere, pendingElsewhere, short: Math.max(0, here + reservedTotal - item.quantityAvailable),
    });
  }
  return out;
}

/** What the couple may still place from stock for an item not on their order. */
export function stockLeftForEvent(
  target: StockEvent, others: StockEvent[], item: StockItem, settings: StockSharingSettings,
): number {
  const reserved = others
    .filter((o) => o.id !== target.id && o.state === "reserved" && eventsCompete(target, o, settings))
    .reduce((s, o) => s + (o.quantities[item.id] ?? 0), 0);
  return Math.max(0, item.quantityAvailable - reserved);
}

export type ItemDateRow = {
  eventId: string;
  name: string;
  date: string;
  state: Exclude<ReservationState, "none">;
  quantity: number;
  /** This event plus approved events that can't share stock with it. */
  reservedWithOthers: number;
  short: number;
};

/** Upcoming events using one item, each with the total it competes against. */
export function upcomingForItem(
  item: StockItem, events: StockEvent[], settings: StockSharingSettings, today: string,
): ItemDateRow[] {
  const using = events.filter((e) => e.state !== "none" && (e.quantities[item.id] ?? 0) > 0 && (e.endDate || e.date) >= today);
  return using
    .map((e) => {
      const others = using.filter((o) => o.id !== e.id && o.state === "reserved" && eventsCompete(e, o, settings));
      const reservedWithOthers = e.quantities[item.id]! + others.reduce((s, o) => s + o.quantities[item.id]!, 0);
      return {
        eventId: e.id, name: e.name, date: e.date, state: e.state as "reserved" | "pending",
        quantity: e.quantities[item.id]!, reservedWithOthers,
        short: item.quantityAvailable > 0 ? Math.max(0, reservedWithOthers - item.quantityAvailable) : 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

export function reservationState(order: { sharedAt: string | null; clientAgreedAt: string | null } | null): ReservationState {
  if (!order) return "none";
  if (order.clientAgreedAt) return "reserved";
  if (order.sharedAt) return "pending";
  return "none";
}

function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** One-line venue copy for an Event Order line, e.g. "120 owned · 40 reserved by other events on Jun 12 — 16 short". */
export function stockSentence(s: EventItemStock, date: string): string {
  const reserved = s.reservedElsewhere.reduce((t, u) => t + u.quantity, 0);
  const pending = s.pendingElsewhere.reduce((t, u) => t + u.quantity, 0);
  const parts = [`${s.owned} owned`];
  parts.push(reserved > 0 ? `${reserved} reserved by other events around ${shortDate(date)}` : `none reserved by other events around ${shortDate(date)}`);
  if (pending > 0) parts.push(`${pending} more waiting on couple approval`);
  const head = parts.join(" · ");
  return s.short > 0 ? `${head} — ${s.short} short` : head;
}

export { shortDate as formatStockDate };
