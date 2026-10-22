/**
 * Connect offered floor-plan layouts to the event's working (operational) layout.
 *
 * Product rules (locked):
 * - One offered layout → clone (or reuse) and set events.operational_floor_plan_id.
 * - Multiple offers → initialize working layout from preferred/default when operational is unset.
 * - Client portal selection → couple_selected_floor_plan_id wins; reconcile operational to that plan.
 * - Never delete existing floor_plans or seating; retarget pointers only.
 * - Idempotent: repeated calls do not create duplicate clones for the same source template.
 * - Do not set couple_selected on automatic venue init (avoids false "client selected" UI).
 */
import type { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type EnsureWorkingLayoutResult = {
  ok: true;
  floorPlanId: string | null;
  created: boolean;
  retargetedOperational: boolean;
  reason:
    | "couple_selected"
    | "sole_offer"
    | "preferred_offer"
    | "already_set"
    | "no_offers"
    | "skipped";
};

/** Pure: which template should seed the working layout when the client has not chosen. */
export function resolveWorkingTemplateId(input: {
  offeredTemplateIds: string[];
  preferredTemplateId: string | null;
}): string | null {
  const offered = input.offeredTemplateIds.filter(Boolean);
  if (offered.length === 0) return null;
  if (offered.length === 1) return offered[0]!;
  if (input.preferredTemplateId && offered.includes(input.preferredTemplateId)) {
    return input.preferredTemplateId;
  }
  return offered[0]!;
}

/** Pure: earliest clone for a source template, or null. */
export function resolveExistingCloneId(
  plans: { id: string; sourceTemplateId: string | null; createdAt: string }[],
  templateId: string,
): string | null {
  const matches = plans
    .filter((p) => p.sourceTemplateId === templateId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return matches[0]?.id ?? null;
}

/**
 * Ensure the event has a working layout derived from offers / client selection.
 * Safe to call from inherit, prepare-release, offer upsert, and the Floor Plans tab.
 */
export async function ensureWorkingLayoutForEvent(
  supabase: DbClient,
  venueId: string,
  eventId: string,
  opts?: { preferredTemplateId?: string | null },
): Promise<EnsureWorkingLayoutResult> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, operational_floor_plan_id, couple_selected_floor_plan_id")
    .eq("id", eventId)
    .eq("venue_id", venueId)
    .maybeSingle<{
      id: string;
      operational_floor_plan_id: string | null;
      couple_selected_floor_plan_id: string | null;
    }>();
  if (eventError) throw eventError;
  if (!event) {
    return { ok: true, floorPlanId: null, created: false, retargetedOperational: false, reason: "skipped" };
  }

  // Client confirmed selection always wins for operational reconciliation.
  if (event.couple_selected_floor_plan_id) {
    const selectedId = event.couple_selected_floor_plan_id;
    const { data: selectedPlan } = await supabase
      .from("floor_plans")
      .select("id")
      .eq("id", selectedId)
      .eq("event_id", eventId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string }>();
    if (selectedPlan) {
      let retargeted = false;
      if (event.operational_floor_plan_id !== selectedId) {
        await supabase
          .from("events")
          .update({ operational_floor_plan_id: selectedId })
          .eq("id", eventId)
          .eq("venue_id", venueId);
        retargeted = true;
      }
      return {
        ok: true,
        floorPlanId: selectedId,
        created: false,
        retargetedOperational: retargeted,
        reason: "couple_selected",
      };
    }
  }

  if (event.operational_floor_plan_id) {
    return {
      ok: true,
      floorPlanId: event.operational_floor_plan_id,
      created: false,
      retargetedOperational: false,
      reason: "already_set",
    };
  }

  const { data: offerRows, error: offerError } = await supabase
    .from("event_floor_plan_offers")
    .select("floor_plan_template_id, sort_order, is_offered, couple_label")
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .eq("is_offered", true)
    .order("sort_order", { ascending: true });
  if (offerError) throw offerError;

  type OfferRow = {
    floor_plan_template_id: string;
    sort_order: number;
    is_offered: boolean;
    couple_label: string | null;
  };
  const offers = (offerRows ?? []) as OfferRow[];
  const offeredTemplateIds = offers.map((r) => r.floor_plan_template_id);
  if (offeredTemplateIds.length === 0) {
    return { ok: true, floorPlanId: null, created: false, retargetedOperational: false, reason: "no_offers" };
  }

  const templateId = resolveWorkingTemplateId({
    offeredTemplateIds,
    preferredTemplateId: opts?.preferredTemplateId ?? null,
  });
  if (!templateId) {
    return { ok: true, floorPlanId: null, created: false, retargetedOperational: false, reason: "no_offers" };
  }

  const { data: planRows, error: planError } = await supabase
    .from("floor_plans")
    .select("id, source_template_id, created_at, name")
    .eq("event_id", eventId)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });
  if (planError) throw planError;

  const existingId = resolveExistingCloneId(
    (planRows ?? []).map((p: { id: string; source_template_id: string | null; created_at: string }) => ({
      id: p.id,
      sourceTemplateId: p.source_template_id,
      createdAt: p.created_at,
    })),
    templateId,
  );

  let floorPlanId = existingId;
  let created = false;

  if (!floorPlanId) {
    const templatesRepo = await import("@/lib/floor-plan-templates/repository");
    const floorRepo = await import("@/lib/floor-plans/repository");
    const template = await templatesRepo.getTemplate(supabase, venueId, templateId);
    if (!template || template.isArchived) {
      return { ok: true, floorPlanId: null, created: false, retargetedOperational: false, reason: "skipped" };
    }
    const objects = await templatesRepo.getObjects(supabase, venueId, templateId);
    const offerLabel = offers.find((r) => r.floor_plan_template_id === templateId);
    const name = offerLabel?.couple_label?.trim() || template.name;

    floorPlanId = await floorRepo.createFloorPlan(
      supabase,
      venueId,
      eventId,
      name,
      template.spaceId,
      templateId,
    );
    if (template.backgroundImageUrl || template.backgroundDocumentId) {
      await floorRepo.updateFloorPlanBackground(
        supabase,
        venueId,
        floorPlanId,
        template.backgroundImageUrl,
        template.backgroundImageOpacity,
        template.backgroundDocumentId,
      );
    }
    await floorRepo.updateFloorPlanRoomSettings(supabase, venueId, floorPlanId, {
      roomWidthFt: template.roomWidthFt,
      roomDepthFt: template.roomDepthFt,
      measurementUnit: template.measurementUnit,
    });
    if (objects.length > 0) {
      await floorRepo.insertObjects(supabase, venueId, floorPlanId, objects);
    }
    created = true;
  }

  await supabase
    .from("events")
    .update({ operational_floor_plan_id: floorPlanId })
    .eq("id", eventId)
    .eq("venue_id", venueId);

  return {
    ok: true,
    floorPlanId,
    created,
    retargetedOperational: true,
    reason: offeredTemplateIds.length === 1 ? "sole_offer" : "preferred_offer",
  };
}
