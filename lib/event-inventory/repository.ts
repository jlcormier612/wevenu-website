import { createClient } from "@/integrations/supabase/server";
import type {
  EventInventory, EventInventoryActivity, EventInventoryItem, EventInventoryWithDetails,
  InventoryItemInput, InventoryTemplate, InventoryTemplateItem, InventoryTemplateWithItems,
} from "@/lib/event-inventory/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type InventoryRow = {
  id: string; venue_id: string; event_id: string; template_id: string | null;
  status: "draft" | "shared" | "finalized"; finalized_at: string | null;
  created_at: string; updated_at: string;
};
type ItemRow = {
  id: string; event_inventory_id: string; venue_id: string; inventory_item_id: string | null;
  name: string; category: string | null; quantity: number; unit_price: number | null;
  is_included: boolean; notes: string | null; sort_order: number;
  added_to_event_order_at: string | null; created_at: string; updated_at: string;
};
type ActivityRow = {
  id: string; event_inventory_id: string; venue_id: string; type: string; title: string;
  description: string | null; created_at: string;
};
type TemplateRow = {
  id: string; venue_id: string; name: string; description: string | null; is_archived: boolean;
  source_master_key: string | null;
  created_at: string; updated_at: string;
};
type TemplateItemRow = {
  id: string; template_id: string; venue_id: string; inventory_item_id: string | null;
  name: string; category: string | null; quantity: number; unit_price: number | null;
  is_included: boolean; notes: string | null; sort_order: number; created_at: string; updated_at: string;
};

const mapInventory = (r: InventoryRow): EventInventory => ({
  id: r.id, venueId: r.venue_id, eventId: r.event_id, templateId: r.template_id,
  status: r.status, finalizedAt: r.finalized_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapItem = (r: ItemRow): EventInventoryItem => ({
  id: r.id, eventInventoryId: r.event_inventory_id, venueId: r.venue_id, inventoryItemId: r.inventory_item_id,
  name: r.name, category: r.category, quantity: Number(r.quantity),
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  isIncluded: r.is_included, notes: r.notes, sortOrder: r.sort_order,
  addedToEventOrderAt: r.added_to_event_order_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapActivity = (r: ActivityRow): EventInventoryActivity => ({
  id: r.id, eventInventoryId: r.event_inventory_id, venueId: r.venue_id, type: r.type,
  title: r.title, description: r.description, createdAt: r.created_at,
});
const mapTemplate = (r: TemplateRow): InventoryTemplate => ({
  id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
  sourceMasterKey: r.source_master_key ?? null,
  isArchived: r.is_archived, createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapTemplateItem = (r: TemplateItemRow): InventoryTemplateItem => ({
  id: r.id, templateId: r.template_id, venueId: r.venue_id, inventoryItemId: r.inventory_item_id,
  name: r.name, category: r.category, quantity: Number(r.quantity),
  unitPrice: r.unit_price == null ? null : Number(r.unit_price),
  isIncluded: r.is_included, notes: r.notes, sortOrder: r.sort_order, createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- event inventory: reads -----------------------------------------------------

export async function getEventInventoryByEvent(client: DbClient, venueId: string, eventId: string): Promise<EventInventoryWithDetails | null> {
  const { data: invRow, error } = await client.from("event_inventory")
    .select("*").eq("event_id", eventId).eq("venue_id", venueId).maybeSingle<InventoryRow>();
  if (error) throw error;
  if (!invRow) return null;

  const [itemsRes, activitiesRes] = await Promise.all([
    client.from("event_inventory_items").select("*").eq("event_inventory_id", invRow.id).order("sort_order"),
    client.from("event_inventory_activities").select("*").eq("event_inventory_id", invRow.id).order("created_at", { ascending: false }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (activitiesRes.error) throw activitiesRes.error;

  return {
    ...mapInventory(invRow),
    items: (itemsRes.data as ItemRow[]).map(mapItem),
    activities: (activitiesRes.data as ActivityRow[]).map(mapActivity),
  };
}

export async function getEventInventoryById(client: DbClient, venueId: string, id: string): Promise<EventInventory | null> {
  const { data, error } = await client.from("event_inventory").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<InventoryRow>();
  if (error) throw error;
  return data ? mapInventory(data) : null;
}

// ---- event inventory: lifecycle ---------------------------------------------------

export async function insertEventInventory(client: DbClient, venueId: string, eventId: string, templateId: string | null): Promise<string> {
  const { data, error } = await client.from("event_inventory")
    .insert({ venue_id: venueId, event_id: eventId, template_id: templateId }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function setStatus(client: DbClient, venueId: string, id: string, status: "draft" | "shared" | "finalized"): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "finalized") patch.finalized_at = new Date().toISOString();
  if (status === "draft") patch.finalized_at = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_inventory") as any).update(patch).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- items ------------------------------------------------------------------------

export async function insertItem(client: DbClient, venueId: string, eventInventoryId: string, input: InventoryItemInput, sortOrder: number): Promise<EventInventoryItem> {
  const quantity = parseFloat(input.quantity) || 1;
  const unitPrice = input.unitPrice?.trim() ? parseFloat(input.unitPrice.replace(/[$,]/g, "")) : null;
  const { data, error } = await client.from("event_inventory_items")
    .insert({
      event_inventory_id: eventInventoryId, venue_id: venueId,
      inventory_item_id: input.inventoryItemId || null,
      name: input.name.trim(), category: input.category?.trim() || null,
      quantity, unit_price: unitPrice, is_included: input.isIncluded,
      notes: input.notes?.trim() || null, sort_order: sortOrder,
    }).select().single<ItemRow>();
  if (error) throw error;
  return mapItem(data);
}

/**
 * Optimistic concurrency (D5 brief §38) — the exact same mechanism D4 built
 * for Contract content (lib/contracts/repository.ts updateContractContent):
 * the caller carries the row's own updated_at as expectedUpdatedAt; zero
 * rows affected means someone else saved first. Applied per-item here
 * (not per-inventory) since Event Inventory is a list of independently
 * editable rows, not one shared text blob — that's the actual level a
 * two-coordinator conflict happens at.
 */
export async function updateItem(
  client: DbClient, venueId: string, itemId: string, input: InventoryItemInput, expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; reason: "stale" | "not_found" }> {
  const quantity = parseFloat(input.quantity) || 1;
  const unitPrice = input.unitPrice?.trim() ? parseFloat(input.unitPrice.replace(/[$,]/g, "")) : null;
  const { data: existing } = await client.from("event_inventory_items").select("id").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ id: string }>();
  if (!existing) return { ok: false, reason: "not_found" };

  const { data, error } = await client.from("event_inventory_items")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      name: input.name.trim(), category: input.category?.trim() || null,
      quantity, unit_price: unitPrice, is_included: input.isIncluded, notes: input.notes?.trim() || null,
    } as any)
    .eq("id", itemId).eq("venue_id", venueId).eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, reason: "stale" };
  return { ok: true };
}

export async function removeItem(client: DbClient, venueId: string, itemId: string): Promise<void> {
  const { error } = await client.from("event_inventory_items").delete().eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
}

/** D8 — marks these items as having actually reached the Event Order, so addToEventOrder's own dedupe check (and the panel's button-visibility check) never re-offer them, while newly added items independently remain eligible. */
export async function markAddedToEventOrder(client: DbClient, venueId: string, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_inventory_items") as any)
    .update({ added_to_event_order_at: new Date().toISOString() })
    .in("id", itemIds).eq("venue_id", venueId);
  if (error) throw error;
}

export async function nextItemSortOrder(client: DbClient, eventInventoryId: string): Promise<number> {
  const { data } = await client.from("event_inventory_items").select("sort_order")
    .eq("event_inventory_id", eventInventoryId).order("sort_order", { ascending: false }).limit(1);
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
}

// ---- activities ----------------------------------------------------------------

export async function insertActivity(client: DbClient, venueId: string, eventInventoryId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("event_inventory_activities")
    .insert({ venue_id: venueId, event_inventory_id: eventInventoryId, type, title, description: description ?? null });
  if (error) throw error;
}

// ---- templates -------------------------------------------------------------------

export async function getTemplates(client: DbClient, venueId: string, includeArchived = false): Promise<InventoryTemplate[]> {
  let q = client.from("inventory_templates").select("*").eq("venue_id", venueId).order("name");
  if (!includeArchived) q = q.eq("is_archived", false);
  const { data, error } = await q;
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<InventoryTemplateWithItems | null> {
  const { data: tRow, error } = await client.from("inventory_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  if (error) throw error;
  if (!tRow) return null;
  const { data: items, error: itemsErr } = await client.from("inventory_template_items").select("*").eq("template_id", id).order("sort_order");
  if (itemsErr) throw itemsErr;
  return { ...mapTemplate(tRow), items: (items as TemplateItemRow[]).map(mapTemplateItem) };
}

export async function insertTemplate(client: DbClient, venueId: string, name: string, description: string): Promise<string> {
  const { data, error } = await client.from("inventory_templates")
    .insert({ venue_id: venueId, name: name.trim(), description: description.trim() || null })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("inventory_templates") as any).update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertTemplateItem(client: DbClient, venueId: string, templateId: string, input: InventoryItemInput, sortOrder: number): Promise<InventoryTemplateItem> {
  const quantity = parseFloat(input.quantity) || 1;
  const unitPrice = input.unitPrice?.trim() ? parseFloat(input.unitPrice.replace(/[$,]/g, "")) : null;
  const { data, error } = await client.from("inventory_template_items")
    .insert({
      template_id: templateId, venue_id: venueId, inventory_item_id: input.inventoryItemId || null,
      name: input.name.trim(), category: input.category?.trim() || null,
      quantity, unit_price: unitPrice, is_included: input.isIncluded,
      notes: input.notes?.trim() || null, sort_order: sortOrder,
    }).select().single<TemplateItemRow>();
  if (error) throw error;
  return mapTemplateItem(data);
}

/** Same optimistic-concurrency shape as updateItem() above (event inventory) — expectedUpdatedAt from the caller's own row, zero rows affected means someone else saved first. */
export async function updateTemplateItem(
  client: DbClient, venueId: string, itemId: string, input: InventoryItemInput, expectedUpdatedAt: string,
): Promise<{ ok: true } | { ok: false; reason: "stale" | "not_found" }> {
  const quantity = parseFloat(input.quantity) || 1;
  const unitPrice = input.unitPrice?.trim() ? parseFloat(input.unitPrice.replace(/[$,]/g, "")) : null;
  const { data: existing } = await client.from("inventory_template_items").select("id").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ id: string }>();
  if (!existing) return { ok: false, reason: "not_found" };

  const { data, error } = await client.from("inventory_template_items")
    .update({
      name: input.name.trim(), category: input.category?.trim() || null,
      quantity, unit_price: unitPrice, is_included: input.isIncluded, notes: input.notes?.trim() || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("id", itemId).eq("venue_id", venueId).eq("updated_at", expectedUpdatedAt)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) return { ok: false, reason: "stale" };
  return { ok: true };
}

export async function removeTemplateItem(client: DbClient, venueId: string, itemId: string): Promise<void> {
  const { error } = await client.from("inventory_template_items").delete().eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function nextTemplateItemSortOrder(client: DbClient, templateId: string): Promise<number> {
  const { data } = await client.from("inventory_template_items").select("sort_order")
    .eq("template_id", templateId).order("sort_order", { ascending: false }).limit(1);
  return ((data?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
}

/** Apply-Template (D5 brief §10) — copies each template item into a brand-new Event Inventory item. Copy at commitment, same as everywhere else in this codebase; the template is never touched, and the new items never reference it live. */
export async function applyTemplateItems(client: DbClient, venueId: string, eventInventoryId: string, templateItems: InventoryTemplateItem[]): Promise<void> {
  if (templateItems.length === 0) return;
  const rows = templateItems.map((t, i) => ({
    event_inventory_id: eventInventoryId, venue_id: venueId, inventory_item_id: t.inventoryItemId,
    name: t.name, category: t.category, quantity: t.quantity, unit_price: t.unitPrice,
    is_included: t.isIncluded, notes: t.notes, sort_order: i,
  }));
  const { error } = await client.from("event_inventory_items").insert(rows);
  if (error) throw error;
}
