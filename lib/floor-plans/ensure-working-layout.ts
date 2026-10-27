/**
 * Connect offered floor-plan layouts to the event's working (operational) layout.
 *
 * Floor Plans Phase 2 (v1.5 §9.2 / F1 / F6):
 * - Never retarget operational from couple preference (couple_selected does not win).
 * - Sole offered template may seed working layout + layout share when operational is unset
 *   (simple one-layout path). Does NOT set couple preference, preference approval, or seating.
 * - Multiple offers with unset operational → leave unset (no preferred/first-offer fallback).
 * - Never delete floor_plans or seating; retarget pointers only when explicitly seeding sole offer.
 * - Idempotent: repeated calls do not create duplicate clones for the same source template.
 */
import type { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type EnsureWorkingLayoutResult = {
  ok: true;
  floorPlanId: string | null;
  created: boolean;
  retargetedOperational: boolean;
  reason:
    | "sole_offer"
    | "already_set"
    | "no_offers"
    | "ambiguous_offers"
    | "skipped";
};

/** Pure: sole offer only may seed working layout. Multi-offer → null (venue must choose). */
export function resolveWorkingTemplateId(input: {
  offeredTemplateIds: string[];
  preferredTemplateId?: string | null;
}): string | null {
  const offered = input.offeredTemplateIds.filter(Boolean);
  if (offered.length === 1) return offered[0]!;
  // preferredTemplateId is ignored for auto-seed — preference ≠ working designation.
  return null;
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
 * Ensure the event has a working layout when the simple sole-offer path applies.
 * Safe to call from inherit, prepare-release, offer upsert, and the Floor Plans tab.
 */
export async function ensureWorkingLayoutForEvent(
  supabase: DbClient,
  venueId: string,
  eventId: string,
  _opts?: { preferredTemplateId?: string | null },
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

  // Preference must never rewrite the working-layout pointer.
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

  const templateId = resolveWorkingTemplateId({ offeredTemplateIds });
  if (!templateId) {
    return {
      ok: true,
      floorPlanId: null,
      created: false,
      retargetedOperational: false,
      reason: "ambiguous_offers",
    };
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

  // Sole-offer simple path: seed working + layout share only.
  // Do not set couple_selected, preference approval, or seating (client_access).
  await supabase
    .from("events")
    .update({ operational_floor_plan_id: floorPlanId })
    .eq("id", eventId)
    .eq("venue_id", venueId);

  await supabase
    .from("floor_plans")
    .update({ shared_with_couple: true })
    .eq("id", floorPlanId)
    .eq("venue_id", venueId)
    .eq("event_id", eventId);

  return {
    ok: true,
    floorPlanId,
    created,
    retargetedOperational: true,
    reason: "sole_offer",
  };
}
