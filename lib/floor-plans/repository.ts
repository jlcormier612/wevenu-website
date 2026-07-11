/**
 * Floor Plans data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  AddObjectInput,
  DisplayShape,
  FloorPlan,
  FloorPlanCanvasObject,
  FloorPlanClientAccess,
  FloorPlanObject,
  FloorPlanWithObjects,
  MeasurementUnit,
  ObjectType,
  ReorderDirection,
  UpdateObjectInput,
  UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type PlanRow = {
  id: string; venue_id: string; event_id: string; name: string; space_id: string | null;
  client_access: FloorPlanClientAccess;
  background_image_url: string | null; background_image_opacity: number; background_locked: boolean;
  room_width_ft: number; room_depth_ft: number; measurement_unit: MeasurementUnit;
  notes: string | null; created_at: string; updated_at: string;
};

type ObjRow = {
  id: string; venue_id: string; floor_plan_id: string;
  object_type: ObjectType; label: string | null; capacity: number | null;
  x: number; y: number; width: number; height: number;
  rotation: number; sort_order: number; inventory_item_id: string | null;
  color: string | null; notes: string | null; locked: boolean;
  display_shape: DisplayShape | null;
  created_at: string; updated_at: string;
};

const mapPlan = (r: PlanRow): FloorPlan => ({
  id: r.id, venueId: r.venue_id, eventId: r.event_id, name: r.name,
  spaceId: r.space_id, clientAccess: r.client_access,
  backgroundImageUrl: r.background_image_url,
  backgroundImageOpacity: Number(r.background_image_opacity),
  backgroundLocked: r.background_locked,
  roomWidthFt: Number(r.room_width_ft), roomDepthFt: Number(r.room_depth_ft),
  measurementUnit: r.measurement_unit,
  notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapObj = (r: ObjRow): FloorPlanObject => ({
  id: r.id, venueId: r.venue_id, floorPlanId: r.floor_plan_id,
  objectType: r.object_type, label: r.label, capacity: r.capacity,
  x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height),
  rotation: Number(r.rotation), sortOrder: r.sort_order, inventoryItemId: r.inventory_item_id,
  color: r.color ?? null, notes: r.notes ?? null, locked: r.locked,
  displayShape: r.display_shape ?? null,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- queries ----------------------------------------------------------------

/** The workspace card grid — every floor plan a booking owns, metadata only (no objects). */
export async function getFloorPlansByEvent(
  client: DbClient, venueId: string, eventId: string,
): Promise<FloorPlan[]> {
  const { data, error } = await client.from("floor_plans").select("*")
    .eq("event_id", eventId).eq("venue_id", venueId).order("created_at");
  if (error) throw error;
  return (data as PlanRow[]).map(mapPlan);
}

/** A single floor plan by its own id, with objects — the editor and print pages. */
export async function getFloorPlan(
  client: DbClient, venueId: string, id: string,
): Promise<FloorPlanWithObjects | null> {
  const [pRes, oRes] = await Promise.all([
    client.from("floor_plans").select("*")
      .eq("id", id).eq("venue_id", venueId).maybeSingle<PlanRow>(),
    client.from("floor_plan_objects").select("*")
      .eq("floor_plan_id", id).eq("venue_id", venueId)
      .order("sort_order").order("created_at"),
  ]);
  if (pRes.error) throw pRes.error;
  if (!pRes.data) return null;
  const objects = (oRes.data as ObjRow[] ?? []).map(mapObj);
  return { ...mapPlan(pRes.data), objects };
}

export async function getAllFloorPlans(
  client: DbClient, venueId: string,
): Promise<FloorPlan[]> {
  const { data, error } = await client.from("floor_plans").select("*")
    .eq("venue_id", venueId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PlanRow[]).map(mapPlan);
}

// ---- mutations --------------------------------------------------------------

export async function createFloorPlan(
  client: DbClient, venueId: string, eventId: string, name = "Floor Plan", spaceId: string | null = null,
): Promise<string> {
  const { data, error } = await client.from("floor_plans")
    .insert({ venue_id: venueId, event_id: eventId, name, space_id: spaceId })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/** "Duplicate Existing Floor Plan" (Booking Floor Plan Workspace task) — clone another floor plan on this same booking into a new one, objects and background included. */
export async function duplicateFloorPlanInto(
  client: DbClient, venueId: string, eventId: string, sourceId: string, name: string, spaceId: string | null,
): Promise<string> {
  const source = await getFloorPlan(client, venueId, sourceId);
  if (!source) throw new Error("Floor plan not found.");

  const { data, error } = await client.from("floor_plans").insert({
    venue_id: venueId, event_id: eventId, name: name.trim(), space_id: spaceId,
    background_image_url: source.backgroundImageUrl, background_image_opacity: source.backgroundImageOpacity,
    room_width_ft: source.roomWidthFt, room_depth_ft: source.roomDepthFt, measurement_unit: source.measurementUnit,
  }).select("id").single<{ id: string }>();
  if (error) throw error;
  const newPlanId = data.id;

  await insertObjects(client, venueId, newPlanId, source.objects);
  return newPlanId;
}

export async function updateFloorPlanBackground(
  client: DbClient, venueId: string, planId: string,
  url: string | null, opacity: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plans") as any).update({
    background_image_url: url, background_image_opacity: opacity,
  }).eq("id", planId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function setFloorPlanBackgroundLocked(
  client: DbClient, venueId: string, planId: string, locked: boolean,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plans") as any)
    .update({ background_locked: locked }).eq("id", planId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Seating Experience — Phase 1: whether the couple can see this Floor Plan
 * at all. 'hidden' (default) means Seating has nothing to show them yet;
 * 'view' or 'edit' means the venue has decided the room is ready to share.
 * Reserved since Client Identity Foundation, never wired to anything until
 * Seating needed exactly this gate.
 */
export async function setFloorPlanClientAccess(
  client: DbClient, venueId: string, planId: string, clientAccess: FloorPlanClientAccess,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plans") as any)
    .update({ client_access: clientAccess }).eq("id", planId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateFloorPlanRoomSettings(
  client: DbClient, venueId: string, planId: string, input: UpdateRoomSettingsInput,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plans") as any).update({
    room_width_ft: input.roomWidthFt, room_depth_ft: input.roomDepthFt, measurement_unit: input.measurementUnit,
  }).eq("id", planId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateFloorPlanNotes(
  client: DbClient, venueId: string, planId: string, notes: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plans") as any)
    .update({ notes: notes.trim() || null })
    .eq("id", planId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function insertObject(
  client: DbClient, venueId: string, planId: string, input: AddObjectInput,
): Promise<FloorPlanObject> {
  const { OBJECT_TYPES } = await import("@/lib/floor-plans/constants");
  const meta = OBJECT_TYPES[input.objectType];
  // Highest existing sort_order + 1, so a newly added or duplicated object
  // renders on top by default (Restore editing tools — Bring Forward/Send Back).
  const { data: maxRow } = await client.from("floor_plan_objects")
    .select("sort_order").eq("floor_plan_id", planId).eq("venue_id", venueId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle<{ sort_order: number }>();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await client.from("floor_plan_objects")
    .insert({
      venue_id: venueId, floor_plan_id: planId,
      object_type: input.objectType,
      label: input.label ?? meta.defaultLabel,
      capacity: input.capacity ?? meta.defaultCapacity,
      x: input.x, y: input.y,
      // An Inventory item's own dimensions override the object type's
      // built-in defaults when provided (Inventory Foundation task).
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

/**
 * Bulk-clone objects verbatim — exact x/y/width/height/rotation, not
 * recomputed from object-type defaults — into a floor plan. Used both when
 * applying a Floor Plan Template and when duplicating another booking floor
 * plan; both a Floor Plan Template's objects and another floor plan's own
 * objects satisfy FloorPlanCanvasObject's minimal shape. Locked state is
 * never carried over — a freshly copied plan starts fully editable.
 */
export async function insertObjects(
  client: DbClient, venueId: string, planId: string, objects: FloorPlanCanvasObject[],
): Promise<void> {
  if (objects.length === 0) return;
  const rows = objects.map((o) => ({
    venue_id: venueId, floor_plan_id: planId, object_type: o.objectType,
    label: o.label, capacity: o.capacity, x: o.x, y: o.y, width: o.width, height: o.height,
    rotation: o.rotation, sort_order: o.sortOrder, inventory_item_id: o.inventoryItemId,
    color: o.color, notes: o.notes, display_shape: o.displayShape,
  }));
  const { error } = await client.from("floor_plan_objects").insert(rows);
  if (error) throw error;
}

export async function updateObject(
  client: DbClient, venueId: string, objId: string, input: UpdateObjectInput,
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (input.x !== undefined)        update.x = input.x;
  if (input.y !== undefined)        update.y = input.y;
  if (input.width !== undefined)    update.width = input.width;
  if (input.height !== undefined)   update.height = input.height;
  if (input.rotation !== undefined) update.rotation = input.rotation;
  if ("label" in input)             update.label = input.label;
  if ("capacity" in input)          update.capacity = input.capacity;
  if ("color" in input)             update.color = input.color;
  if ("notes" in input)             update.notes = input.notes;
  if (input.locked !== undefined)   update.locked = input.locked;
  if ("displayShape" in input)      update.display_shape = input.displayShape;
  if (Object.keys(update).length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("floor_plan_objects") as any)
    .update(update).eq("id", objId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteObject(
  client: DbClient, venueId: string, objId: string,
): Promise<void> {
  const { error } = await client.from("floor_plan_objects")
    .delete().eq("id", objId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * "Bring Forward" / "Send Back" (Restore editing tools) — swaps this
 * object's sort_order with its nearest neighbor on the same side. A canvas
 * tool, not an Inventory concept; reuses the sort_order column that has
 * existed since Sprint 18.
 */
export async function reorderObject(
  client: DbClient, venueId: string, planId: string, objId: string, direction: ReorderDirection,
): Promise<void> {
  const { data: siblings, error } = await client.from("floor_plan_objects")
    .select("id, sort_order").eq("floor_plan_id", planId).eq("venue_id", venueId)
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
  const table = client.from("floor_plan_objects") as any;
  const { error: e1 } = await table.update({ sort_order: neighbor.sort_order }).eq("id", current.id).eq("venue_id", venueId);
  if (e1) throw e1;
  const { error: e2 } = await table.update({ sort_order: current.sort_order }).eq("id", neighbor.id).eq("venue_id", venueId);
  if (e2) throw e2;
}

export async function clearAllObjects(
  client: DbClient, venueId: string, planId: string,
): Promise<void> {
  const { error } = await client.from("floor_plan_objects")
    .delete().eq("floor_plan_id", planId).eq("venue_id", venueId);
  if (error) throw error;
}
