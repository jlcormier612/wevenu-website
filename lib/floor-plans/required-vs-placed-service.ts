import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as eoRepo from "@/lib/event-orders/repository";
import * as repo from "@/lib/floor-plans/repository";
import {
  comparisonPlanForSetup,
  computeRequiredVsPlaced,
  summarySentence,
  type RequiredVsPlaced,
  type RvpItem,
  type RvpLine,
  type RvpObject,
  type RvpSection,
  type RvpSetup,
} from "@/lib/floor-plans/required-vs-placed";
import * as inventoryRepo from "@/lib/inventory/repository";
import { getCurrentVenue } from "@/lib/venue/service";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type EventInputs = {
  setups: RvpSetup[];
  sections: RvpSection[];
  lines: RvpLine[];
  items: RvpItem[];
  hasEventOrder: boolean;
};

async function loadEventInputs(client: DbClient, venueId: string, eventId: string): Promise<EventInputs> {
  const [eventOrder, items, setupRows, memberRows] = await Promise.all([
    eoRepo.getEventOrderByEvent(client, venueId, eventId),
    inventoryRepo.getItems(client, venueId),
    repo.listEventFloorPlanSetups(client, venueId, eventId),
    repo.listSetupMembersForEvent(client, venueId, eventId),
  ]);

  const offeringIds = [...new Set((eventOrder?.lines ?? []).map((l) => l.offeringId).filter((id): id is string => Boolean(id)))];
  const offeringInventory = new Map<string, string | null>();
  if (offeringIds.length > 0) {
    const { data, error } = await client.from("offerings").select("id, inventory_item_id")
      .eq("venue_id", venueId).in("id", offeringIds);
    if (error) throw error;
    for (const o of (data ?? []) as { id: string; inventory_item_id: string | null }[]) {
      offeringInventory.set(o.id, o.inventory_item_id);
    }
  }

  return {
    hasEventOrder: Boolean(eventOrder),
    setups: setupRows.map((s) => ({
      id: s.id,
      name: s.name,
      memberPlanIds: memberRows.filter((m) => m.setup_id === s.id).map((m) => m.floor_plan_id),
      operationalPlanId: s.operational_floor_plan_id,
      coupleSelectedPlanId: s.couple_selected_floor_plan_id,
    })),
    sections: (eventOrder?.sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      floorPlanId: s.floorPlanId,
      floorPlanSetupId: s.floorPlanSetupId ?? null,
      floorPlanSetupName: s.floorPlanSetupName ?? null,
      notOnFloorPlan: s.notOnFloorPlan ?? false,
    })),
    lines: (eventOrder?.lines ?? []).map((l) => ({
      sectionId: l.sectionId,
      inventoryItemId: l.inventoryItemId ?? (l.offeringId ? offeringInventory.get(l.offeringId) ?? null : null),
      quantity: Number(l.quantity),
    })),
    items: items.map((i) => ({
      id: i.id,
      name: i.printableName || i.name,
      availableForFloorPlans: i.availableForFloorPlans,
      countsAsSeats: i.countsAsSeats ?? false,
    })),
  };
}

async function loadPlanObjects(client: DbClient, venueId: string, planIds: string[]): Promise<Map<string, RvpObject[]>> {
  const byPlan = new Map<string, RvpObject[]>(planIds.map((id) => [id, []]));
  if (planIds.length === 0) return byPlan;
  const { data, error } = await client.from("floor_plan_objects")
    .select("floor_plan_id, inventory_item_id, capacity")
    .eq("venue_id", venueId).in("floor_plan_id", planIds);
  if (error) throw error;
  for (const o of (data ?? []) as { floor_plan_id: string; inventory_item_id: string | null; capacity: number | null }[]) {
    byPlan.get(o.floor_plan_id)?.push({ inventoryItemId: o.inventory_item_id, capacity: o.capacity });
  }
  return byPlan;
}

export type FloorPlanRequiredVsPlaced = RequiredVsPlaced & { hasEventOrder: boolean };

/** Required vs placed for the layout being viewed. */
export async function getRequiredVsPlacedForPlan(eventId: string, planId: string): Promise<FloorPlanRequiredVsPlaced | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const client = await createClient();
  const [inputs, objects] = await Promise.all([
    loadEventInputs(client, venue.id, eventId),
    loadPlanObjects(client, venue.id, [planId]),
  ]);
  return {
    ...computeRequiredVsPlaced({ planId, ...inputs, objects: objects.get(planId) ?? [] }),
    hasEventOrder: inputs.hasEventOrder,
  };
}

export type FloorPlanStatusLine = {
  key: string;
  label: string;
  planId: string;
  sentence: string;
  shortCount: number;
};

/**
 * One line per setup (judged on its operational layout, else the couple's
 * pick, else its first layout) — or per layout when the event has no setups.
 */
export async function getRequiredVsPlacedSummaryForEvent(
  eventId: string, planIds: { id: string; name: string }[],
): Promise<{ lines: FloorPlanStatusLine[]; unmatchedSections: { id: string; name: string }[] }> {
  const empty = { lines: [], unmatchedSections: [] };
  if (!isSupabaseConfigured || planIds.length === 0) return empty;
  const venue = await getCurrentVenue();
  if (!venue) return empty;
  const client = await createClient();
  const inputs = await loadEventInputs(client, venue.id, eventId);
  if (!inputs.hasEventOrder) return empty;

  const targets: { key: string; label: string; planId: string }[] = inputs.setups.length > 0
    ? inputs.setups
      .map((s) => ({ key: s.id, label: s.name, planId: comparisonPlanForSetup(s) }))
      .filter((t): t is { key: string; label: string; planId: string } => Boolean(t.planId))
    : planIds.map((p) => ({ key: p.id, label: p.name, planId: p.id }));

  const objects = await loadPlanObjects(client, venue.id, [...new Set(targets.map((t) => t.planId))]);
  let unmatchedSections: { id: string; name: string }[] = [];
  const lines = targets.map((t) => {
    const result = computeRequiredVsPlaced({ planId: t.planId, ...inputs, objects: objects.get(t.planId) ?? [] });
    if (result.unmatchedSections.length > 0) unmatchedSections = result.unmatchedSections;
    return { key: t.key, label: t.label, planId: t.planId, sentence: summarySentence(result), shortCount: result.shortCount };
  });
  return { lines, unmatchedSections };
}
