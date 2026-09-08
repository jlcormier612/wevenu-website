/**
 * Venue appointment catalog data access. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import {
  mapScheduleItemTypeRow,
  type ScheduleItemTypeRow,
  type VenueScheduleItemType,
} from "@/lib/calendar/schedule-item-catalog";

type DbClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof import("@/integrations/supabase/admin").createAdminClient>;

export async function listVenueScheduleItemTypes(
  client: DbClient,
  venueId: string,
): Promise<VenueScheduleItemType[]> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order")
    .order("label");
  if (error) throw error;
  return ((data ?? []) as ScheduleItemTypeRow[]).map(mapScheduleItemTypeRow);
}

export async function getBuiltinScheduleItemType(
  client: DbClient,
  venueId: string,
  builtinKey: string,
): Promise<VenueScheduleItemType | null> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .select("*")
    .eq("venue_id", venueId)
    .eq("source", "builtin")
    .eq("builtin_key", builtinKey)
    .maybeSingle<ScheduleItemTypeRow>();
  if (error) throw error;
  return data ? mapScheduleItemTypeRow(data) : null;
}

export async function getScheduleItemTypeById(
  client: DbClient,
  venueId: string,
  id: string,
): Promise<VenueScheduleItemType | null> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .select("*")
    .eq("venue_id", venueId)
    .eq("id", id)
    .maybeSingle<ScheduleItemTypeRow>();
  if (error) throw error;
  return data ? mapScheduleItemTypeRow(data) : null;
}

export async function getCustomScheduleItemTypeByKey(
  client: DbClient,
  venueId: string,
  customKey: string,
): Promise<VenueScheduleItemType | null> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .select("*")
    .eq("venue_id", venueId)
    .eq("source", "custom")
    .eq("custom_key", customKey)
    .is("archived_at", null)
    .maybeSingle<ScheduleItemTypeRow>();
  if (error) throw error;
  return data ? mapScheduleItemTypeRow(data) : null;
}

/** Idempotent seed for paths that create venues outside the SQL trigger (defensive). */
export async function seedVenueScheduleItemTypes(
  client: DbClient,
  venueId: string,
): Promise<void> {
  const { error } = await client.rpc("seed_venue_schedule_item_types", {
    p_venue_id: venueId,
  });
  if (error) throw error;
}

/**
 * Updates builtin enabled / blocks_availability only.
 * Never rewrites calendar_blocks rows.
 */
export async function updateBuiltinScheduleItemTypeRow(
  client: DbClient,
  venueId: string,
  builtinKey: string,
  patch: { enabled?: boolean; blocksAvailability?: boolean },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.blocksAvailability !== undefined) update.blocks_availability = patch.blocksAvailability;
  if (Object.keys(update).length === 0) return;

  const { data, error } = await client
    .from("venue_schedule_item_types")
    .update(update)
    .eq("venue_id", venueId)
    .eq("source", "builtin")
    .eq("builtin_key", builtinKey)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data?.id) throw new Error("Schedule appointment type not found for this venue.");
}

/**
 * Insert a custom catalog row. Never writes calendar_blocks.
 */
export async function insertCustomScheduleItemTypeRow(
  client: DbClient,
  venueId: string,
  input: {
    customKey: string;
    label: string;
    blocksAvailability: boolean;
    groupKey: "meetings" | "availability" | "other";
    sortOrder: number;
  },
): Promise<VenueScheduleItemType> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .insert({
      venue_id: venueId,
      source: "custom",
      builtin_key: null,
      custom_key: input.customKey,
      label: input.label,
      enabled: true,
      blocks_availability: input.blocksAvailability,
      group_key: input.groupKey,
      sort_order: input.sortOrder,
      archived_at: null,
    })
    .select("*")
    .single<ScheduleItemTypeRow>();
  if (error) throw error;
  return mapScheduleItemTypeRow(data);
}

/**
 * Update custom label / blocks_availability / group_key.
 * Never rewrites calendar_blocks titles or snapshots.
 */
export async function updateCustomScheduleItemTypeRow(
  client: DbClient,
  venueId: string,
  id: string,
  patch: {
    label?: string;
    blocksAvailability?: boolean;
    groupKey?: "meetings" | "availability" | "other";
  },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.label !== undefined) update.label = patch.label;
  if (patch.blocksAvailability !== undefined) update.blocks_availability = patch.blocksAvailability;
  if (patch.groupKey !== undefined) update.group_key = patch.groupKey;
  if (Object.keys(update).length === 0) return;

  const { data, error } = await client
    .from("venue_schedule_item_types")
    .update(update)
    .eq("venue_id", venueId)
    .eq("source", "custom")
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data?.id) throw new Error("Custom appointment type not found for this venue.");
}

export async function archiveCustomScheduleItemTypeRow(
  client: DbClient,
  venueId: string,
  id: string,
): Promise<void> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .update({ archived_at: new Date().toISOString(), enabled: false })
    .eq("venue_id", venueId)
    .eq("source", "custom")
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data?.id) throw new Error("Custom appointment type not found for this venue.");
}

export async function restoreCustomScheduleItemTypeRow(
  client: DbClient,
  venueId: string,
  id: string,
): Promise<void> {
  const { data, error } = await client
    .from("venue_schedule_item_types")
    .update({ archived_at: null, enabled: true })
    .eq("venue_id", venueId)
    .eq("source", "custom")
    .eq("id", id)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data?.id) throw new Error("Custom appointment type not found for this venue.");
}
