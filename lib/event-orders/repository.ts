import { createClient } from "@/integrations/supabase/server";
import type {
  AddCustomLineInput, AddInventoryLineInput, AddOfferingLineInput, UpdateLineInput,
  EventOrder, EventOrderActivity, EventOrderLine, EventOrderSection, EventOrderSharePayload,
  EventOrderWithDetails,
} from "@/lib/event-orders/types";
import { sumLines } from "@/lib/event-orders/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type OrderRow = {
  id: string; venue_id: string; event_id: string | null; client_id?: string | null; status: "open" | "finalized";
  revision: number; finalized_at: string | null; shared_at: string | null;
  client_agreed_at?: string | null; client_agreed_name?: string | null; client_agreed_revision?: number | null;
  review_token?: string | null;
  template_id: string | null;
  created_at: string; updated_at: string;
};
type SectionRow = {
  id: string; event_order_id: string; venue_id: string; name: string; sort_order: number;
  floor_plan_id: string | null; created_at: string; updated_at: string;
  floor_plan_setup_id?: string | null; floor_plan_setup_name?: string | null; not_on_floor_plan?: boolean | null;
};
type LineRow = {
  id: string; event_order_id: string; venue_id: string; section_id: string | null;
  provenance: "package" | "inventory" | "custom" | "offering";
  package_id: string | null; inventory_item_id: string | null; offering_id: string | null;
  description: string; description_detail: string | null;
  quantity: number; unit: string | null; unit_price: number | null; amount: number;
  is_included: boolean; notes: string | null;
  bound_to_headcount?: boolean | null;
  sort_order: number;
  created_at: string; updated_at: string;
};
type ActivityRow = {
  id: string; event_order_id: string; venue_id: string; type: string; title: string;
  description: string | null; created_at: string;
};

const mapOrder = (r: OrderRow): EventOrder => ({
  id: r.id, venueId: r.venue_id, eventId: r.event_id ?? "", clientId: r.client_id ?? null, status: r.status,
  revision: r.revision, finalizedAt: r.finalized_at, sharedAt: r.shared_at,
  clientAgreedAt: r.client_agreed_at ?? null,
  clientAgreedName: r.client_agreed_name ?? null,
  clientAgreedRevision: r.client_agreed_revision ?? null,
  reviewToken: r.review_token ?? null,
  templateId: r.template_id,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapSection = (r: SectionRow): EventOrderSection => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, name: r.name,
  sortOrder: r.sort_order, floorPlanId: r.floor_plan_id, createdAt: r.created_at, updatedAt: r.updated_at,
  floorPlanSetupId: r.floor_plan_setup_id ?? null,
  floorPlanSetupName: r.floor_plan_setup_name ?? null,
  notOnFloorPlan: r.not_on_floor_plan ?? false,
});
const mapLine = (r: LineRow): EventOrderLine => ({
  id: r.id, eventOrderId: r.event_order_id, venueId: r.venue_id, sectionId: r.section_id,
  provenance: r.provenance, packageId: r.package_id, inventoryItemId: r.inventory_item_id,
  offeringId: r.offering_id ?? null,
  description: r.description, descriptionDetail: r.description_detail ?? null,
  quantity: Number(r.quantity), unit: r.unit ?? null,
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  amount: Number(r.amount), isIncluded: r.is_included ?? true, notes: r.notes ?? null,
  boundToHeadcount: r.bound_to_headcount === true,
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

export async function insertEventOrderForClient(client: DbClient, venueId: string, clientId: string, templateId: string | null = null): Promise<string> {
  const { data, error } = await client.from("event_orders")
    .insert({ venue_id: venueId, event_id: null, client_id: clientId, template_id: templateId }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function getEventOrderByClient(client: DbClient, venueId: string, clientId: string): Promise<EventOrderWithDetails | null> {
  const { data: orderRow, error } = await client.from("event_orders")
    .select("*").eq("client_id", clientId).is("event_id", null).eq("venue_id", venueId).maybeSingle<OrderRow>();
  if (error) throw error;
  if (!orderRow) return null;
  return hydrateEventOrder(client, orderRow);
}

async function hydrateEventOrder(client: DbClient, orderRow: OrderRow): Promise<EventOrderWithDetails> {
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

export async function finalizeEventOrder(client: DbClient, venueId: string, eventOrderId: string, nextRevision: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_orders") as any)
    .update({ status: "finalized", revision: nextRevision, finalized_at: new Date().toISOString() })
    .eq("id", eventOrderId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function reopenEventOrder(client: DbClient, venueId: string, eventOrderId: string): Promise<void> {
  // Clears client agreement — a new share + accept is required after amendment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_orders") as any)
    .update({
      status: "open",
      finalized_at: null,
      client_agreed_at: null,
      client_agreed_name: null,
      client_agreed_revision: null,
    })
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

/** Most recent share snapshot for an Event Order (portal authority until re-share). */
export async function getLatestShareSnapshot(
  client: DbClient,
  venueId: string,
  eventOrderId: string,
): Promise<{ revision: number; payload: EventOrderSharePayload; sharedAt: string } | null> {
  const { data, error } = await client
    .from("event_order_share_snapshots")
    .select("revision,payload,shared_at")
    .eq("venue_id", venueId)
    .eq("event_order_id", eventOrderId)
    .order("shared_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ revision: number; payload: EventOrderSharePayload; shared_at: string }>();
  if (error) throw error;
  if (!data) return null;
  return { revision: data.revision, payload: data.payload, sharedAt: data.shared_at };
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

export async function insertSection(
  client: DbClient, venueId: string, eventOrderId: string, name: string, sortOrder: number,
  floorPlanDefaults?: { floorPlanSetupName?: string | null; notOnFloorPlan?: boolean },
): Promise<EventOrderSection> {
  const row: Record<string, unknown> = { event_order_id: eventOrderId, venue_id: venueId, name: name.trim(), sort_order: sortOrder };
  if (floorPlanDefaults?.floorPlanSetupName?.trim()) row.floor_plan_setup_name = floorPlanDefaults.floorPlanSetupName.trim();
  if (floorPlanDefaults?.notOnFloorPlan) row.not_on_floor_plan = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("event_order_sections") as any)
    .insert(row)
    .select().single();
  if (error) throw error;
  return mapSection(data as SectionRow);
}

export async function updateSectionFloorPlan(
  client: DbClient, venueId: string, sectionId: string, floorPlanId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_sections") as any)
    .update({ floor_plan_id: floorPlanId }).eq("id", sectionId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateSectionFloorPlanSetup(
  client: DbClient, venueId: string, eventOrderId: string, sectionId: string,
  input: { floorPlanSetupId: string | null; notOnFloorPlan: boolean },
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_sections") as any)
    .update({ floor_plan_setup_id: input.floorPlanSetupId, not_on_floor_plan: input.notOnFloorPlan, floor_plan_id: null })
    .eq("id", sectionId).eq("event_order_id", eventOrderId).eq("venue_id", venueId);
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
      bound_to_headcount: input.boundToHeadcount === true,
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
      bound_to_headcount: input.boundToHeadcount === true,
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
      bound_to_headcount: input.boundToHeadcount === true,
      sort_order: sortOrder,
    }).select().single<LineRow>();
  if (error) throw error;
  return mapLine(data);
}

/** B2 — set quantity/amount on a bound line without clearing headcount binding. */
export async function updateLineQuantityKeepingBound(
  client: DbClient,
  venueId: string,
  lineId: string,
  quantity: number,
  unitPrice: number | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_order_lines") as any)
    .update({
      quantity,
      amount: lineAmount(quantity, unitPrice),
    })
    .eq("id", lineId)
    .eq("venue_id", venueId);
  if (error) throw error;
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

/** Clears lines then sections for a full package replace on an open Event Order. */
export async function clearEventOrderContents(
  client: DbClient,
  venueId: string,
  eventOrderId: string,
): Promise<void> {
  const { error: linesError } = await client.from("event_order_lines")
    .delete()
    .eq("event_order_id", eventOrderId)
    .eq("venue_id", venueId);
  if (linesError) throw linesError;
  const { error: sectionsError } = await client.from("event_order_sections")
    .delete()
    .eq("event_order_id", eventOrderId)
    .eq("venue_id", venueId);
  if (sectionsError) throw sectionsError;
}

export async function setEventOrderTemplateId(
  client: DbClient,
  venueId: string,
  eventOrderId: string,
  templateId: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_orders") as any)
    .update({ template_id: templateId })
    .eq("id", eventOrderId)
    .eq("venue_id", venueId);
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
