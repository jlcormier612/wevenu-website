import { createClient } from "@/integrations/supabase/server";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddOfferingLineInput, UpdateLineInput,
  EventOrder, EventOrderActivity, EventOrderLine, EventOrderSection, EventOrderSharePayload,
  EventOrderWithDetails,
} from "@/lib/event-orders/types";
import { sumLines } from "@/lib/event-orders/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type OrderRow = {
  id: string; venue_id: string; event_id: string; status: "open" | "finalized";
  revision: number; finalized_at: string | null; shared_at: string | null; template_id: string | null;
  created_at: string; updated_at: string;
};
type SectionRow = {
  id: string; event_order_id: string; venue_id: string; name: string; sort_order: number;
  floor_plan_id: string | null; created_at: string; updated_at: string;
};
type LineRow = {
  id: string; event_order_id: string; venue_id: string; section_id: string | null;
  provenance: "package" | "inventory" | "custom" | "offering";
  package_id: string | null; inventory_item_id: string | null; offering_id: string | null;
  description: string; description_detail: string | null;
  quantity: number; unit: string | null; unit_price: number | null; amount: number;
  is_included: boolean; notes: string | null; sort_order: number;
  created_at: string; updated_at: string;
};
type ActivityRow = {
  id: string; event_order_id: string; venue_id: string; type: string; title: string;
  description: string | null; created_at: string;
};

const mapOrder = (r: OrderRow): EventOrder => ({
  id: r.id, venueId: r.venue_id, eventId: r.event_id, status: r.status,
  revision: r.revision, finalizedAt: r.finalized_at, sharedAt: r.shared_at, templateId: r.template_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapSection = (r: SectionRow): EventOrderSection => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, name: r.name,
  sortOrder: r.sort_order, floorPlanId: r.floor_plan_id, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapLine = (r: LineRow): EventOrderLine => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, sectionId: r.section_id,
  provenance: r.provenance, packageId: r.package_id, inventoryItemId: r.inventory_item_id,
  offeringId: r.offering_id ?? null,
  description: r.description, descriptionDetail: r.description_detail ?? null,
  quantity: Number(r.quantity), unit: r.unit ?? null,
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  amount: Number(r.amount), isIncluded: r.is_included ?? true, notes: r.notes ?? null,
  sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapActivity = (r: ActivityRow): EventOrderActivity => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, type: r.type,
  title: r.title, description: r.description, createdAt: r.created_at,
});

function parseOptionalPrice(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

function lineAmount(quantity: number, unitPrice: number | null): number {
  return quantity * (unitPrice ?? 0);
}

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

// ---- lifecycle -----------------------------------------------------

export async function insertEventOrder(client: DbClient, venueId: string, eventId: string, templateId: string | null = null): Promise<string> {
  const { data, error } = await client.from("event_orders")
    .insert({ venue_id: venueId, event_id: eventId, template_id: templateId }).select("id").single<{ id: string }>();
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

/** Never cleared by reopen — client continues seeing the last share snapshot until re-share. */
export async function setSharedAt(client: DbClient, venueId: string, eventOrderId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_orders") as any)
    .update({ shared_at: new Date().toISOString() })
    .eq("id", eventOrderId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertShareSnapshot(
  client: DbClient,
  venueId: string,
  eventOrderId: string,
  revision: number,
  payload: EventOrderSharePayload,
): Promise<void> {
  const { error } = await client.from("event_order_share_snapshots").insert({
    venue_id: venueId,
    event_order_id: eventOrderId,
    revision,
    payload,
  });
  if (error) throw error;
}

export function buildSharePayload(order: EventOrderWithDetails): EventOrderSharePayload {
  return {
    sections: order.sections.map((s) => ({ id: s.id, name: s.name, sortOrder: s.sortOrder })),
    lines: order.lines.map((l) => ({
      id: l.id,
      sectionId: l.sectionId,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      amount: l.amount,
      isIncluded: l.isIncluded,
      notes: l.notes,
      sortOrder: l.sortOrder,
    })),
  };
}

// ---- sections -------------------------------------------------------------------

export async function insertSection(client: DbClient, venueId: string, eventOrderId: string, name: string, sortOrder: number): Promise<EventOrderSection> {
  const { data, error } = await client.from("event_order_sections")
    .insert({ event_order_id: eventOrderId, venue_id: venueId, name: name.trim(), sort_order: sortOrder })
    .select().single<SectionRow>();
  if (error) throw error;
  return mapSection(data);
}

export async function updateSectionFloorPlan(
  client: DbClient, venueId: string, sectionId: string, floorPlanId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_sections") as any)
    .update({ floor_plan_id: floorPlanId }).eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

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
      is_included: true, sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function insertLineFromInventory(
  client: DbClient, venueId: string, eventOrderId: string, input: AddInventoryLineInput, sortOrder: number,
): Promise<EventOrderLine> {
  const quantity = parseFloat(input.quantity);
  const unitPrice = parseOptionalPrice(input.unitPrice);
  const { data, error } = await client.from("event_order_lines")
    .insert({
      event_order_id: eventOrderId, venue_id: venueId, section_id: input.sectionId,
      provenance: "inventory", inventory_item_id: input.inventoryItemId,
      description: input.description.trim(), quantity, unit: input.unit?.trim() || null,
      unit_price: unitPrice, amount: lineAmount(quantity, unitPrice),
      is_included: input.isIncluded ?? true, notes: input.notes?.trim() || null,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function insertLineFromOffering(
  client: DbClient, venueId: string, eventOrderId: string, input: AddOfferingLineInput, sortOrder: number,
): Promise<EventOrderLine> {
  const quantity = parseFloat(input.quantity);
  const unitPrice = parseOptionalPrice(input.unitPrice);
  const { data, error } = await client.from("event_order_lines")
    .insert({
      event_order_id: eventOrderId, venue_id: venueId, section_id: input.sectionId,
      provenance: "offering", offering_id: input.offeringId,
      inventory_item_id: input.inventoryItemId ?? null,
      description: input.description.trim(),
      description_detail: input.descriptionDetail?.trim() || null,
      quantity, unit: input.unit?.trim() || null,
      unit_price: unitPrice, amount: lineAmount(quantity, unitPrice),
      is_included: input.isIncluded ?? true, notes: input.notes?.trim() || null,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function insertCustomLine(
  client: DbClient, venueId: string, eventOrderId: string, input: AddCustomLineInput, sortOrder: number,
): Promise<EventOrderLine> {
  const quantity = parseFloat(input.quantity);
  const unitPrice = parseOptionalPrice(input.unitPrice);
  const { data, error } = await client.from("event_order_lines")
    .insert({
      event_order_id: eventOrderId, venue_id: venueId, section_id: input.sectionId,
      provenance: "custom", description: input.description.trim(),
      description_detail: input.descriptionDetail?.trim() || null,
      quantity, unit: input.unit?.trim() || null,
      unit_price: unitPrice, amount: lineAmount(quantity, unitPrice),
      is_included: input.isIncluded ?? true, notes: input.notes?.trim() || null,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

export async function updateLine(
  client: DbClient, venueId: string, lineId: string, input: UpdateLineInput,
): Promise<EventOrderLine> {
  const quantity = parseFloat(input.quantity);
  const unitPrice = parseOptionalPrice(input.unitPrice);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("event_order_lines") as any)
    .update({
      description: input.description.trim(),
      description_detail: input.descriptionDetail?.trim() || null,
      quantity,
      unit: input.unit?.trim() || null,
      unit_price: unitPrice,
      amount: lineAmount(quantity, unitPrice),
      is_included: input.isIncluded,
      notes: input.notes?.trim() || null,
      section_id: input.sectionId,
    })
    .eq("id", lineId).eq("venue_id", venueId)
    .select().single();
  if (error) throw error;
  return mapLine(data as LineRow);
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
