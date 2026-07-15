import { createClient } from "@/integrations/supabase/server";
import type {
  AddCustomLineInput, AddInventoryLineInput,
  EventOrder, EventOrderActivity, EventOrderLine, EventOrderSection, EventOrderWithDetails,
} from "@/lib/event-orders/types";
import { sumLines } from "@/lib/event-orders/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type OrderRow = {
  id: string; venue_id: string; event_id: string; status: "open" | "finalized";
  revision: number; finalized_at: string | null; created_at: string; updated_at: string;
};
type SectionRow = {
  id: string; event_order_id: string; venue_id: string; name: string; sort_order: number;
  floor_plan_id: string | null; created_at: string; updated_at: string;
};
type LineRow = {
  id: string; event_order_id: string; venue_id: string; section_id: string | null;
  provenance: "package" | "inventory" | "custom"; package_id: string | null; inventory_item_id: string | null;
  description: string; quantity: number; unit_price: number; amount: number; sort_order: number;
  created_at: string; updated_at: string;
};
type ActivityRow = {
  id: string; event_order_id: string; venue_id: string; type: string; title: string;
  description: string | null; created_at: string;
};

const mapOrder = (r: OrderRow): EventOrder => ({
  id: r.id, venueId: r.venue_id, eventId: r.event_id, status: r.status,
  revision: r.revision, finalizedAt: r.finalized_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapSection = (r: SectionRow): EventOrderSection => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, name: r.name,
  sortOrder: r.sort_order, floorPlanId: r.floor_plan_id, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapLine = (r: LineRow): EventOrderLine => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, sectionId: r.section_id,
  provenance: r.provenance, packageId: r.package_id, inventoryItemId: r.inventory_item_id,
  description: r.description, quantity: Number(r.quantity), unitPrice: Number(r.unit_price),
  amount: Number(r.amount), sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapActivity = (r: ActivityRow): EventOrderActivity => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, type: r.type,
  title: r.title, description: r.description, createdAt: r.created_at,
});

// ---- reads --------------------------------------------------------------------

export async function getEventOrderByEvent(client: DbClient, venueId: string, eventId: string): Promise<EventOrderWithDetails | null> {
  const { data: orderRow, error } = await client.from("event_orders")
    .select("*").eq("event_id", eventId).eq("venue_id", venueId).maybeSingle<OrderRow>();
  if (error) throw error;
  if (!orderRow) return null;

  const [sectionsRes, linesRes, activitiesRes] = await Promise.all([
    client.from("event_order_sections").select("*").eq("event_order_id", orderRow.id).order("sort_order"),
    client.from("event_order_lines").select("*").eq("event_order_id", orderRow.id).order("sort_order"),
    client.from("event_order_activities").select("*").eq("event_order_id", orderRow.id).order("created_at", { ascending: false }),
  ]);
  if (sectionsRes.error) throw sectionsRes.error;
  if (linesRes.error) throw linesRes.error;
  if (activitiesRes.error) throw activitiesRes.error;

  const lines = (linesRes.data as LineRow[]).map(mapLine);
  return {
    ...mapOrder(orderRow),
    sections: (sectionsRes.data as SectionRow[]).map(mapSection),
    lines,
    activities: (activitiesRes.data as ActivityRow[]).map(mapActivity),
    total: sumLines(lines),
  };
}

export async function getEventOrderById(client: DbClient, venueId: string, eventOrderId: string): Promise<EventOrder | null> {
  const { data, error } = await client.from("event_orders").select("*").eq("id", eventOrderId).eq("venue_id", venueId).maybeSingle<OrderRow>();
  if (error) throw error;
  return data ? mapOrder(data) : null;
}

// ---- event order lifecycle -----------------------------------------------------

export async function insertEventOrder(client: DbClient, venueId: string, eventId: string): Promise<string> {
  const { data, error } = await client.from("event_orders")
    .insert({ venue_id: venueId, event_id: eventId }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function finalizeEventOrder(client: DbClient, venueId: string, eventOrderId: string, nextRevision: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_orders") as any)
    .update({ status: "finalized", revision: nextRevision, finalized_at: new Date().toISOString() })
    .eq("id", eventOrderId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function reopenEventOrder(client: DbClient, venueId: string, eventOrderId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_orders") as any)
    .update({ status: "open", finalized_at: null })
    .eq("id", eventOrderId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- sections -------------------------------------------------------------------

export async function insertSection(client: DbClient, venueId: string, eventOrderId: string, name: string, sortOrder: number): Promise<EventOrderSection> {
  const { data, error } = await client.from("event_order_sections")
    .insert({ event_order_id: eventOrderId, venue_id: venueId, name: name.trim(), sort_order: sortOrder })
    .select().single<SectionRow>();
  if (error) throw error;
  return mapSection(data);
}

/**
 * Phase 4 — links (or unlinks, when floorPlanId is null) this Section to a
 * Floor Plan for reconciliation. Pure Event Order authoring — Event Order
 * owns which Section corresponds to which Floor Plan; this never touches
 * the Floor Plan itself.
 */
export async function updateSectionFloorPlan(
  client: DbClient, venueId: string, sectionId: string, floorPlanId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_sections") as any)
    .update({ floor_plan_id: floorPlanId }).eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

/** Unsets section_id on every line first — removing a Section must never delete the commitments recorded on its lines. */
export async function removeSection(client: DbClient, venueId: string, sectionId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: unlinkError } = await (client.from("event_order_lines") as any)
    .update({ section_id: null }).eq("section_id", sectionId).eq("venue_id", venueId);
  if (unlinkError) throw unlinkError;
  const { error } = await client.from("event_order_sections").delete().eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- lines ------------------------------------------------------------------------

export async function insertLineFromPackage(
  client: DbClient, venueId: string, eventOrderId: string,
  input: { packageId: string; description: string; unitPrice: number; sectionId: string | null },
  sortOrder: number,
): Promise<EventOrderLine> {
  const { data, error } = await client.from("event_order_lines")
    .insert({
      event_order_id: eventOrderId, venue_id: venueId, section_id: input.sectionId,
      provenance: "package", package_id: input.packageId,
      description: input.description, quantity: 1, unit_price: input.unitPrice, amount: input.unitPrice,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function insertLineFromInventory(
  client: DbClient, venueId: string, eventOrderId: string, input: AddInventoryLineInput, sortOrder: number,
): Promise<EventOrderLine> {
  const quantity = parseFloat(input.quantity);
  const unitPrice = parseFloat(input.unitPrice.replace(/[$,]/g, ""));
  const { data, error } = await client.from("event_order_lines")
    .insert({
      event_order_id: eventOrderId, venue_id: venueId, section_id: input.sectionId,
      provenance: "inventory", inventory_item_id: input.inventoryItemId,
      description: input.description.trim(), quantity, unit_price: unitPrice, amount: quantity * unitPrice,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function insertCustomLine(
  client: DbClient, venueId: string, eventOrderId: string, input: AddCustomLineInput, sortOrder: number,
): Promise<EventOrderLine> {
  const quantity = parseFloat(input.quantity);
  const unitPrice = parseFloat(input.unitPrice.replace(/[$,]/g, ""));
  const { data, error } = await client.from("event_order_lines")
    .insert({
      event_order_id: eventOrderId, venue_id: venueId, section_id: input.sectionId,
      provenance: "custom", description: input.description.trim(), quantity, unit_price: unitPrice,
      amount: quantity * unitPrice, sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function removeLine(client: DbClient, venueId: string, lineId: string): Promise<void> {
  const { error } = await client.from("event_order_lines").delete().eq("id", lineId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function nextSortOrder(client: DbClient, table: "event_order_sections" | "event_order_lines", eventOrderId: string): Promise<number> {
  const { data } = await client.from(table).select("sort_order").eq("event_order_id", eventOrderId).order("sort_order", { ascending: false }).limit(1);
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
}

// ---- activities ----------------------------------------------------------------

export async function insertActivity(client: DbClient, venueId: string, eventOrderId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("event_order_activities")
    .insert({ venue_id: venueId, event_order_id: eventOrderId, type, title, description: description ?? null });
  if (error) throw error;
}
