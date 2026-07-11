/**
 * Floor Plan Templates data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  AddObjectInput, DisplayShape, MeasurementUnit, ObjectType, ReorderDirection, UpdateObjectInput, UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";
import type {
  FloorPlanTemplate, FloorPlanTemplateObject, FloorPlanTemplateWithStats,
} from "@/lib/floor-plan-templates/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type TemplateRow = {
  id: string; venue_id: string; name: string; event_type: string | null; space_id: string | null;
  is_default: boolean; is_archived: boolean;
  background_image_url: string | null; background_image_opacity: number; background_locked: boolean;
  room_width_ft: number; room_depth_ft: number; measurement_unit: MeasurementUnit;
  created_at: string; updated_at: string;
};

type ObjRow = {
  id: string; venue_id: string; template_id: string;
  object_type: ObjectType; label: string | null; capacity: number | null;
  x: number; y: number; width: number; height: number;
  rotation: number; sort_order: number; inventory_item_id: string | null;
  color: string | null; notes: string | null; locked: boolean;
  display_shape: DisplayShape | null;
  created_at: string; updated_at: string;
};

const mapTemplate = (r: TemplateRow): FloorPlanTemplate => ({
  id: r.id, venueId: r.venue_id, name: r.name, eventType: r.event_type, spaceId: r.space_id,
  isDefault: r.is_default, isArchived: r.is_archived,
  backgroundImageUrl: r.background_image_url, backgroundImageOpacity: Number(r.background_image_opacity),
  backgroundLocked: r.background_locked,
  roomWidthFt: Number(r.room_width_ft), roomDepthFt: Number(r.room_depth_ft), measurementUnit: r.measurement_unit,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapObj = (r: ObjRow): FloorPlanTemplateObject => ({
  id: r.id, venueId: r.venue_id, templateId: r.template_id,
  objectType: r.object_type, label: r.label, capacity: r.capacity,
  x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height),
  rotation: Number(r.rotation), sortOrder: r.sort_order, inventoryItemId: r.inventory_item_id,
  color: r.color ?? null, notes: r.notes ?? null, locked: r.locked,
  displayShape: r.display_shape ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- Templates ---------------------------------------------------------------

// Archived excluded by default, matching every other template library this
// venue has (Planning, Timeline, Pipeline) — any future booking-apply flow
// gets Requirement 9's behavior for free.
export async function getTemplates(client: DbClient, venueId: string, opts?: { includeArchived?: boolean }): Promise<FloorPlanTemplate[]> {
  let query = client.from("floor_plan_templates").select("*").eq("venue_id", venueId);
  if (!opts?.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return (data as TemplateRow[]).map(mapTemplate);
}

export async function getTemplate(client: DbClient, venueId: string, id: string): Promise<FloorPlanTemplate | null> {
  const { data } = await client.from("floor_plan_templates").select("*").eq("id", id).eq("venue_id", venueId).maybeSingle<TemplateRow>();
  return data ? mapTemplate(data) : null;
}

/** Library card grid needs the space name and object count alongside every template — flat fetches + JS grouping, not an embedded-relationship select. */
export async function getTemplatesWithStats(client: DbClient, venueId: string): Promise<FloorPlanTemplateWithStats[]> {
  const [{ data: templateRows, error: templateError }, { data: objRows, error: objError }, { data: spaceRows, error: spaceError }] = await Promise.all([
    client.from("floor_plan_templates").select("*").eq("venue_id", venueId).order("name"),
    client.from("floor_plan_template_objects").select("template_id").eq("venue_id", venueId),
    client.from("venue_spaces").select("id, name").eq("venue_id", venueId),
  ]);
  if (templateError) throw templateError;
  if (objError) throw objError;
  if (spaceError) throw spaceError;

  const objectCounts = new Map<string, number>();
  for (const row of objRows as { template_id: string }[]) objectCounts.set(row.template_id, (objectCounts.get(row.template_id) ?? 0) + 1);

  const spaceNames = new Map<string, string>();
  for (const row of spaceRows as { id: string; name: string }[]) spaceNames.set(row.id, row.name);

  return (templateRows as TemplateRow[]).map((r) => ({
    ...mapTemplate(r),
    spaceName: r.space_id ? spaceNames.get(r.space_id) ?? null : null,
    objectCount: objectCounts.get(r.id) ?? 0,
  }));
}

export async function insertTemplate(client: DbClient, venueId: string, name: string, eventType: string | null, spaceId: string | null): Promise<string> {
  const { data, error } = await client.from("floor_plan_templates")
    .insert({ venue_id: venueId, name: name.trim(), event_type: eventType || null, space_id: spaceId || null })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function renameTemplate(client: DbClient, venueId: string, id: string, name: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_templates") as any).update({ name: name.trim() }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/** Clear-then-set within the same (venue, event_type, space) group so the unique partial index never sees two defaults at once. */
export async function setTemplateDefault(client: DbClient, venueId: string, id: string, eventType: string | null, spaceId: string | null): Promise<void> {
  let clearQuery = client.from("floor_plan_templates").update({ is_default: false } as never).eq("venue_id", venueId).neq("id", id);
  clearQuery = eventType ? clearQuery.eq("event_type", eventType) : clearQuery.is("event_type", null);
  clearQuery = spaceId ? clearQuery.eq("space_id", spaceId) : clearQuery.is("space_id", null);
  const { error: clearError } = await clearQuery;
  if (clearError) throw clearError;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_templates") as any).update({ is_default: true }).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setTemplateArchived(client: DbClient, venueId: string, id: string, isArchived: boolean): Promise<void> {
  // Archiving can't leave a template as the default — it would disappear
  // from apply flows while still being auto-selected.
  const patch: Record<string, unknown> = { is_archived: isArchived };
  if (isArchived) patch.is_default = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_templates") as any).update(patch).eq("id", id).eq("venue_id", venueId);
  if (error) throw error;
}

/** Clone a template's objects into a brand-new template — same event type, space, and background as the source. */
export async function duplicateTemplateInto(client: DbClient, venueId: string, sourceTemplateId: string, newName: string): Promise<string> {
  const source = await getTemplate(client, venueId, sourceTemplateId);
  if (!source) throw new Error("Template not found.");

  const { data, error } = await client.from("floor_plan_templates").insert({
    venue_id: venueId, name: newName.trim(), event_type: source.eventType, space_id: source.spaceId,
    background_image_url: source.backgroundImageUrl, background_image_opacity: source.backgroundImageOpacity,
    room_width_ft: source.roomWidthFt, room_depth_ft: source.roomDepthFt, measurement_unit: source.measurementUnit,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const newTemplateId = data.id;

  const objects = await getObjects(client, venueId, sourceTemplateId);
  if (objects.length > 0) {
    const rows = objects.map((o) => ({
      venue_id: venueId, template_id: newTemplateId, object_type: o.objectType,
      label: o.label, capacity: o.capacity, x: o.x, y: o.y, width: o.width, height: o.height,
      rotation: o.rotation, sort_order: o.sortOrder, inventory_item_id: o.inventoryItemId,
      color: o.color, notes: o.notes, display_shape: o.displayShape,
    }));
    const { error: insertError } = await client.from("floor_plan_template_objects").insert(rows);
    if (insertError) throw insertError;
  }

  return newTemplateId;
}

// ---- Objects ---------------------------------------------------------------

export async function getObjects(client: DbClient, venueId: string, templateId: string): Promise<FloorPlanTemplateObject[]> {
  const { data, error } = await client.from("floor_plan_template_objects").select("*")
    .eq("template_id", templateId).eq("venue_id", venueId).order("sort_order").order("created_at");
  if (error) throw error;
  return (data as ObjRow[]).map(mapObj);
}

export async function insertObject(client: DbClient, venueId: string, templateId: string, input: AddObjectInput): Promise<FloorPlanTemplateObject> {
  const { OBJECT_TYPES } = await import("@/lib/floor-plans/constants");
  const meta = OBJECT_TYPES[input.objectType];
  const { data: maxRow } = await client.from("floor_plan_template_objects")
    .select("sort_order").eq("template_id", templateId).eq("venue_id", venueId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await client.from("floor_plan_template_objects")
    .insert({
      venue_id: venueId, template_id: templateId,
      object_type: input.objectType,
      label: input.label ?? meta.defaultLabel,
      capacity: input.capacity ?? meta.defaultCapacity,
      x: input.x, y: input.y,
      width: input.width ?? meta.defaultWidth, height: input.height ?? meta.defaultHeight,
      rotation: input.rotation ?? 0,
      inventory_item_id: input.inventoryItemId ?? null,
      color: input.color ?? null, notes: input.notes ?? null,
      display_shape: input.displayShape ?? null,
      sort_order: nextSortOrder,
    })
    .select().single<ObjRow>();
  if (error) throw error;
  return mapObj(data);
}

export async function updateObject(client: DbClient, venueId: string, objId: string, input: UpdateObjectInput): Promise<void> {
  const update: Record<string, unknown> = {};
  if (input.x !== undefined) update.x = input.x;
  if (input.y !== undefined) update.y = input.y;
  if (input.width !== undefined) update.width = input.width;
  if (input.height !== undefined) update.height = input.height;
  if (input.rotation !== undefined) update.rotation = input.rotation;
  if ("label" in input) update.label = input.label;
  if ("capacity" in input) update.capacity = input.capacity;
  if ("color" in input) update.color = input.color;
  if ("notes" in input) update.notes = input.notes;
  if (input.locked !== undefined) update.locked = input.locked;
  if ("displayShape" in input) update.display_shape = input.displayShape;
  if (Object.keys(update).length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_template_objects") as any).update(update).eq("id", objId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteObject(client: DbClient, venueId: string, objId: string): Promise<void> {
  const { error } = await client.from("floor_plan_template_objects").delete().eq("id", objId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function clearObjects(client: DbClient, venueId: string, templateId: string): Promise<void> {
  const { error } = await client.from("floor_plan_template_objects").delete().eq("template_id", templateId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateBackground(client: DbClient, venueId: string, templateId: string, url: string | null, opacity: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_templates") as any)
    .update({ background_image_url: url, background_image_opacity: opacity })
    .eq("id", templateId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setBackgroundLocked(client: DbClient, venueId: string, templateId: string, locked: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_templates") as any)
    .update({ background_locked: locked }).eq("id", templateId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateRoomSettings(client: DbClient, venueId: string, templateId: string, input: UpdateRoomSettingsInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_templates") as any).update({
    room_width_ft: input.roomWidthFt, room_depth_ft: input.roomDepthFt, measurement_unit: input.measurementUnit,
  }).eq("id", templateId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function reorderObject(
  client: DbClient, venueId: string, templateId: string, objId: string, direction: ReorderDirection,
): Promise<void> {
  const { data: siblings, error } = await client.from("floor_plan_template_objects")
    .select("id, sort_order").eq("template_id", templateId).eq("venue_id", venueId)
    .order("sort_order").order("created_at");
  if (error) throw error;
  const rows = (siblings ?? []) as { id: string; sort_order: number }[];
  const index = rows.findIndex((r) => r.id === objId);
  if (index === -1) return;
  const neighborIndex = direction === "forward" ? index + 1 : index - 1;
  if (neighborIndex < 0 || neighborIndex >= rows.length) return;

  const current = rows[index];
  const neighbor = rows[neighborIndex];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = client.from("floor_plan_template_objects") as any;
  const { error: e1 } = await table.update({ sort_order: neighbor.sort_order }).eq("id", current.id).eq("venue_id", venueId);
  if (e1) throw e1;
  const { error: e2 } = await table.update({ sort_order: current.sort_order }).eq("id", neighbor.id).eq("venue_id", venueId);
  if (e2) throw e2;
}
