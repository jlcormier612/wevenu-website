import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  DEFAULT_STOCK_SHARING,
  reservationState,
  stockForEvent,
  upcomingForItem,
  type EventItemStock,
  type ItemDateRow,
  type StockEvent,
  type StockSharingSettings,
} from "@/lib/inventory/reservations";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type EventRow = {
  id: string; name: string; status: string; event_date: string; event_end_date: string | null;
  start_time: string | null; end_time: string | null; setup_time: string | null; teardown_time: string | null;
};

const BOOKED = ["confirmed", "complete"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function loadStockSharing(client: DbClient, venueId: string): Promise<StockSharingSettings> {
  const { data } = await client.from("venues")
    .select("inventory_sharing_mode, inventory_turnaround_minutes")
    .eq("id", venueId)
    .maybeSingle<{ inventory_sharing_mode: string | null; inventory_turnaround_minutes: number | null }>();
  if (!data) return DEFAULT_STOCK_SHARING;
  return {
    mode: data.inventory_sharing_mode === "by_time" ? "by_time" : "same_day",
    turnaroundMinutes: data.inventory_turnaround_minutes ?? DEFAULT_STOCK_SHARING.turnaroundMinutes,
  };
}

/** Booked events (plus any extra ids) whose start date falls in [from, to], with Event Order item quantities. */
async function loadStockEvents(
  client: DbClient, venueId: string, from: string, to: string | null, includeIds: string[] = [],
): Promise<StockEvent[]> {
  let q = client.from("events")
    .select("id,name,status,event_date,event_end_date,start_time,end_time,setup_time,teardown_time")
    .eq("venue_id", venueId)
    .gte("event_date", from);
  if (to) q = q.lte("event_date", to);
  const { data: rows } = await q.returns<EventRow[]>();
  const events = (rows ?? []).filter((e) => BOOKED.includes(e.status) || includeIds.includes(e.id));
  for (const id of includeIds) {
    if (!events.some((e) => e.id === id)) {
      const { data } = await client.from("events")
        .select("id,name,status,event_date,event_end_date,start_time,end_time,setup_time,teardown_time")
        .eq("venue_id", venueId).eq("id", id).maybeSingle<EventRow>();
      if (data) events.push(data);
    }
  }
  if (events.length === 0) return [];

  const { data: orders } = await client.from("event_orders")
    .select("id,event_id,shared_at,client_agreed_at")
    .eq("venue_id", venueId)
    .in("event_id", events.map((e) => e.id))
    .returns<{ id: string; event_id: string; shared_at: string | null; client_agreed_at: string | null }[]>();
  const orderByEvent = new Map((orders ?? []).map((o) => [o.event_id, o]));
  const orderIds = (orders ?? []).map((o) => o.id);

  const { data: lines } = orderIds.length > 0
    ? await client.from("event_order_lines")
      .select("event_order_id,inventory_item_id,offering_id,quantity")
      .eq("venue_id", venueId)
      .in("event_order_id", orderIds)
      .returns<{ event_order_id: string; inventory_item_id: string | null; offering_id: string | null; quantity: number }[]>()
    : { data: [] as { event_order_id: string; inventory_item_id: string | null; offering_id: string | null; quantity: number }[] };
  const offeringIds = [...new Set((lines ?? []).filter((l) => !l.inventory_item_id && l.offering_id).map((l) => l.offering_id!))];
  const { data: offerings } = offeringIds.length > 0
    ? await client.from("offerings").select("id,inventory_item_id").eq("venue_id", venueId).in("id", offeringIds)
      .returns<{ id: string; inventory_item_id: string | null }[]>()
    : { data: [] as { id: string; inventory_item_id: string | null }[] };
  const offeringItem = new Map((offerings ?? []).map((o) => [o.id, o.inventory_item_id]));

  const qtyByOrder = new Map<string, Record<string, number>>();
  for (const l of lines ?? []) {
    const itemId = l.inventory_item_id ?? (l.offering_id ? offeringItem.get(l.offering_id) ?? null : null);
    if (!itemId) continue;
    const q = qtyByOrder.get(l.event_order_id) ?? {};
    q[itemId] = (q[itemId] ?? 0) + Number(l.quantity || 0);
    qtyByOrder.set(l.event_order_id, q);
  }

  return events.map((e) => {
    const order = orderByEvent.get(e.id) ?? null;
    return {
      id: e.id, name: e.name, date: e.event_date, endDate: e.event_end_date,
      startTime: e.start_time, endTime: e.end_time, setupTime: e.setup_time, teardownTime: e.teardown_time,
      state: BOOKED.includes(e.status)
        ? reservationState(order ? { sharedAt: order.shared_at, clientAgreedAt: order.client_agreed_at } : null)
        : "none",
      quantities: order ? qtyByOrder.get(order.id) ?? {} : {},
    };
  });
}

async function loadTrackedItems(client: DbClient, venueId: string, itemIds?: string[]) {
  let q = client.from("inventory_items").select("id,name,printable_name,quantity_available").eq("venue_id", venueId);
  if (itemIds) q = q.in("id", itemIds);
  const { data } = await q.returns<{ id: string; name: string; printable_name: string | null; quantity_available: number }[]>();
  return (data ?? []).map((i) => ({ id: i.id, name: i.printable_name || i.name, quantityAvailable: Number(i.quantity_available || 0) }));
}

export type EventOrderStock = { date: string | null; items: EventItemStock[] };

/** Stock picture for each tracked item on an event's Event Order. Read-only. */
export async function getEventOrderStock(eventId: string): Promise<EventOrderStock> {
  if (!isSupabaseConfigured) return { date: null, items: [] };
  const venue = await getCurrentVenue();
  if (!venue) return { date: null, items: [] };
  const client = await createClient();
  const { data: ev } = await client.from("events").select("event_date,event_end_date")
    .eq("venue_id", venue.id).eq("id", eventId).maybeSingle<{ event_date: string; event_end_date: string | null }>();
  if (!ev) return { date: null, items: [] };
  const from = addDays(ev.event_date, -31);
  const to = addDays(ev.event_end_date || ev.event_date, 1);
  const [settings, events] = await Promise.all([
    loadStockSharing(client, venue.id),
    loadStockEvents(client, venue.id, from, to, [eventId]),
  ]);
  const target = events.find((e) => e.id === eventId);
  if (!target) return { date: ev.event_date, items: [] };
  const items = await loadTrackedItems(client, venue.id, Object.keys(target.quantities));
  return { date: ev.event_date, items: stockForEvent(target, events, items, settings) };
}

/** Upcoming booked events using one item, each with what it competes against. Read-only. */
export async function getItemUpcomingReservations(itemId: string): Promise<{ owned: number; rows: ItemDateRow[]; settings: StockSharingSettings }> {
  if (!isSupabaseConfigured) return { owned: 0, rows: [], settings: DEFAULT_STOCK_SHARING };
  const venue = await getCurrentVenue();
  if (!venue) return { owned: 0, rows: [], settings: DEFAULT_STOCK_SHARING };
  const client = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [settings, events, items] = await Promise.all([
    loadStockSharing(client, venue.id),
    loadStockEvents(client, venue.id, addDays(today, -31), null),
    loadTrackedItems(client, venue.id, [itemId]),
  ]);
  const item = items[0];
  if (!item) return { owned: 0, rows: [], settings };
  return { owned: item.quantityAvailable, rows: upcomingForItem(item, events, settings, today), settings };
}

export async function getStockSharingForCurrentVenue(): Promise<StockSharingSettings> {
  if (!isSupabaseConfigured) return DEFAULT_STOCK_SHARING;
  const venue = await getCurrentVenue();
  if (!venue) return DEFAULT_STOCK_SHARING;
  return loadStockSharing(await createClient(), venue.id);
}
