/**
 * Floor Plans data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  AddObjectInput,
  FloorPlan,
  FloorPlanObject,
  FloorPlanWithObjects,
  ObjectType,
  UpdateObjectInput,
} from "@/lib/floor-plans/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type PlanRow = {
  id: string; venue_id: string; event_id: string; name: string;
  background_image_url: string | null; background_image_opacity: number;
  notes: string | null; created_at: string; updated_at: string;
};

type ObjRow = {
  id: string; venue_id: string; floor_plan_id: string;
  object_type: ObjectType; label: string | null; capacity: number | null;
  x: number; y: number; width: number; height: number;
  rotation: number; sort_order: number; created_at: string; updated_at: string;
};

const mapPlan = (r: PlanRow): FloorPlan => ({
  id: r.id, venueId: r.venue_id, eventId: r.event_id, name: r.name,
  backgroundImageUrl: r.background_image_url,
  backgroundImageOpacity: Number(r.background_image_opacity),
  notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
});

const mapObj = (r: ObjRow): FloorPlanObject => ({
  id: r.id, venueId: r.venue_id, floorPlanId: r.floor_plan_id,
  objectType: r.object_type, label: r.label, capacity: r.capacity,
  x: Number(r.x), y: Number(r.y), width: Number(r.width), height: Number(r.height),
  rotation: Number(r.rotation), sortOrder: r.sort_order,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

// ---- queries ----------------------------------------------------------------

export async function getFloorPlanByEvent(
  client: DbClient, venueId: string, eventId: string,
): Promise<FloorPlanWithObjects | null> {
  const [pRes, oRes] = await Promise.all([
    client.from("floor_plans").select("*")
      .eq("event_id", eventId).eq("venue_id", venueId).maybeSingle<PlanRow>(),
    client.from("floor_plan_objects").select("*")
      .eq("venue_id", venueId)
      .order("sort_order").order("created_at"),
  ]);
  if (pRes.error) throw pRes.error;
  if (!pRes.data) return null;
  const objects = (oRes.data as ObjRow[] ?? [])
    .filter((o) => o.floor_plan_id === pRes.data!.id)
    .map(mapObj);
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
  client: DbClient, venueId: string, eventId: string, name = "Floor Plan",
): Promise<string> {
  const { data, error } = await client.from("floor_plans")
    .insert({ venue_id: venueId, event_id: eventId, name })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
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
  const { data, error } = await client.from("floor_plan_objects")
    .insert({
      venue_id: venueId, floor_plan_id: planId,
      object_type: input.objectType,
      label: input.label ?? meta.defaultLabel,
      capacity: input.capacity ?? meta.defaultCapacity,
      x: input.x, y: input.y,
      width: meta.defaultWidth, height: meta.defaultHeight,
    })
    .select().single<ObjRow>();
  if (error) throw error;
  return mapObj(data);
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

export async function clearAllObjects(
  client: DbClient, venueId: string, planId: string,
): Promise<void> {
  const { error } = await client.from("floor_plan_objects")
    .delete().eq("floor_plan_id", planId).eq("venue_id", venueId);
  if (error) throw error;
}
