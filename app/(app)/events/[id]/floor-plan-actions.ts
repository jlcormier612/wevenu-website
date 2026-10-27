"use server";

import { revalidatePath } from "next/cache";

import {
  addObject,
  applyTemplate,
  clearFloorPlan,
  createFloorPlan,
  deleteFloorPlan,
  deleteObject_,
  duplicateFloorPlan,
  getFloorPlanReconciliation,
  renameFloorPlan,
  reorderObject,
  setBackgroundLocked,
  setClientAccess,
  setCoupleShare,
  approveClientFloorPlanLayout,
  requestClientFloorPlanChanges,
  setCoupleMayAddTables,
  setFinalized,
  setOperationalFloorPlan,
  setVendorAccess,
  attachBackgroundDocument,
  updateBackground,
  updateNotes,
  updateObject_,
  updateRoomSettings,
} from "@/lib/floor-plans/service";
import type {
  AddObjectInput,
  CreateFloorPlanResult,
  FloorPlan,
  FloorPlanActionResult,
  FloorPlanObject,
  FloorPlanSectionReconciliation,
  ReorderDirection,
  UpdateObjectInput,
  UpdateRoomSettingsInput,
} from "@/lib/floor-plans/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/clients/${eventId}`);
}

// The workspace's card grid lives on the event's floor-plans index — revalidate
// it whenever a new floor plan is created so the new card shows up. The
// day-of dashboard also lists floor plans (Quick Floor Plans) and needs the
// same treatment whenever a plan's name or existence changes.
function revalidateWorkspace(eventId: string) {
  revalidatePath(`/events/${eventId}/floor-plans`);
  revalidatePath(`/events/${eventId}/today`);
}

export async function createFloorPlanAction(eventId: string, name?: string, spaceId?: string | null): Promise<CreateFloorPlanResult> {
  const result = await createFloorPlan(eventId, name, spaceId ?? null);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function applyTemplateAction(
  eventId: string, templateId: string, name: string, spaceId: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await applyTemplate(eventId, templateId, name, spaceId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function duplicateFloorPlanAction(
  eventId: string, sourceFloorPlanId: string, name: string, spaceId: string | null,
): Promise<CreateFloorPlanResult> {
  const result = await duplicateFloorPlan(eventId, sourceFloorPlanId, name, spaceId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function updateBackgroundAction(
  planId: string, eventId: string, url: string | null, opacity: number,
  backgroundDocumentId?: string | null,
): Promise<FloorPlanActionResult> {
  const result = await updateBackground(planId, url, opacity, backgroundDocumentId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function attachFloorPlanBackgroundAction(
  planId: string,
  eventId: string,
  payload: {
    name: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    storageUrl: string;
    renderableImageUrl: string;
    opacity: number;
  },
): Promise<FloorPlanActionResult & { documentId?: string }> {
  const result = await attachBackgroundDocument(planId, eventId, payload);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateNotesAction(
  planId: string, eventId: string, notes: string,
): Promise<FloorPlanActionResult> {
  const result = await updateNotes(planId, notes);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function renameFloorPlanAction(
  planId: string, eventId: string, name: string,
): Promise<FloorPlanActionResult> {
  const result = await renameFloorPlan(planId, name);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function deleteFloorPlanAction(
  planId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await deleteFloorPlan(planId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function addObjectAction(
  planId: string, eventId: string, input: AddObjectInput,
): Promise<{ ok: true; object: FloorPlanObject } | FloorPlanActionResult> {
  const result = await addObject(planId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateObjectAction(
  objId: string, input: UpdateObjectInput,
): Promise<FloorPlanActionResult> {
  return updateObject_(objId, input);
}

export async function deleteObjectAction(
  objId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await deleteObject_(objId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function clearFloorPlanAction(
  planId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await clearFloorPlan(planId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function setBackgroundLockedAction(
  planId: string, eventId: string, locked: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setBackgroundLocked(planId, locked);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Seating Experience — Phase 1: share (or hide) this Floor Plan with the couple. */
export async function setClientAccessAction(
  planId: string, eventId: string, clientAccess: FloorPlan["clientAccess"],
): Promise<FloorPlanActionResult> {
  const result = await setClientAccess(planId, clientAccess);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Sprint 1 — Vendor Event Assets: share (or unshare) this Floor Plan with vendors assigned to the event. */
export async function setVendorAccessAction(
  planId: string, eventId: string, sharedWithVendors: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setVendorAccess(planId, sharedWithVendors);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Phase 1 — Share Floor Plan with the couple (layout view). Independent of Share for Seating. */
export async function setCoupleShareAction(
  planId: string, eventId: string, sharedWithCouple: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setCoupleShare(planId, sharedWithCouple);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Phase 1 — venue sets the durable operational Floor Plan for this event (or clears it). */
export async function setOperationalFloorPlanAction(
  eventId: string, floorPlanId: string | null,
): Promise<FloorPlanActionResult> {
  const result = await setOperationalFloorPlan(eventId, floorPlanId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

/** Phase 2 — offer a venue template to the couple for this event. */
export async function upsertFloorPlanOfferAction(
  eventId: string,
  input: {
    templateId: string;
    sortOrder?: number;
    isOffered?: boolean;
    coupleLabel?: string | null;
    coupleBlurb?: string | null;
  },
): Promise<{ ok: true; offerId: string } | FloorPlanActionResult> {
  const { upsertEventFloorPlanOffer } = await import("@/lib/floor-plan-offers/service");
  const result = await upsertEventFloorPlanOffer(eventId, input);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

/** Overview setup — recover offers from profile template ids and init working layout. */
export async function ensureEventFloorPlanOffersAction(
  eventId: string,
  templateIds: string[],
  preferredId: string | null = null,
): Promise<{ ok: true; created: number } | FloorPlanActionResult> {
  const { ensureEventFloorPlanOffers } = await import("@/lib/floor-plan-offers/service");
  const result = await ensureEventFloorPlanOffers(eventId, templateIds, preferredId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

/**
 * Initialize or reconcile the event's working (operational) layout from offers
 * or the client's confirmed selection. Idempotent — does not duplicate clones.
 */
export async function ensureWorkingFloorPlanAction(
  eventId: string,
  preferredTemplateId: string | null = null,
): Promise<
  | { ok: true; floorPlanId: string | null; created: boolean; reason: string }
  | FloorPlanActionResult
> {
  if (!eventId) return { ok: false, message: "Event is required." };
  const { createClient } = await import("@/integrations/supabase/server");
  const { getCurrentVenue, getCurrentUserRole } = await import("@/lib/venue/service");
  const { canEditFloorPlans, FLOOR_PLAN_EDIT_DENIED } = await import("@/lib/floor-plans/authorize");
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const role = await getCurrentUserRole();
  if (!canEditFloorPlans(role)) return { ok: false, message: FLOOR_PLAN_EDIT_DENIED };
  const supabase = await createClient();
  const { ensureWorkingLayoutForEvent } = await import("@/lib/floor-plans/ensure-working-layout");
  const result = await ensureWorkingLayoutForEvent(supabase, venue.id, eventId, {
    preferredTemplateId,
  });
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
    if (result.floorPlanId) {
      revalidatePath(`/events/${eventId}/floor-plans/${result.floorPlanId}`);
    }
  }
  return {
    ok: true,
    floorPlanId: result.floorPlanId,
    created: result.created,
    reason: result.reason,
  };
}

/** Phase 2 — update offer metadata / re-enable. */
export async function updateFloorPlanOfferAction(
  eventId: string,
  offerId: string,
  patch: {
    sortOrder?: number;
    isOffered?: boolean;
    coupleLabel?: string | null;
    coupleBlurb?: string | null;
  },
): Promise<FloorPlanActionResult> {
  const { updateEventFloorPlanOffer } = await import("@/lib/floor-plan-offers/service");
  const result = await updateEventFloorPlanOffer(offerId, patch);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

/**
 * Phase 2 — withdraw from couple chooser only.
 * Does not clear couple_selected_floor_plan_id or delete the clone.
 */
export async function withdrawFloorPlanOfferAction(
  eventId: string,
  offerId: string,
): Promise<FloorPlanActionResult> {
  const { withdrawEventFloorPlanOffer } = await import("@/lib/floor-plan-offers/service");
  const result = await withdrawEventFloorPlanOffer(offerId);
  if (result.ok) { revalidateEvent(eventId); revalidateWorkspace(eventId); }
  return result;
}

export async function updateRoomSettingsAction(
  planId: string, eventId: string, input: UpdateRoomSettingsInput,
): Promise<FloorPlanActionResult> {
  const result = await updateRoomSettings(planId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reorderObjectAction(
  planId: string, objId: string, eventId: string, direction: ReorderDirection,
): Promise<FloorPlanActionResult> {
  const result = await reorderObject(planId, objId, direction);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/**
 * Phase 4 — the coordinator's own "print-ready" checkpoint. Reversible
 * (Reopen clears it), and never gates placement editing before, during, or
 * after — a coordinator can keep editing a Final floor plan freely.
 */
export async function setFloorPlanFinalizedAction(
  planId: string, eventId: string, finalized: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setFinalized(planId, finalized);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/** Phase 4 — read-only, fact-based comparison. Never writes to either side. */
export async function getFloorPlanReconciliationAction(
  planId: string,
): Promise<FloorPlanSectionReconciliation[]> {
  return getFloorPlanReconciliation(planId);
}

export async function setFloorPlanCoupleMayAddTablesAction(
  planId: string, eventId: string, coupleMayAddTables: boolean,
): Promise<FloorPlanActionResult> {
  const result = await setCoupleMayAddTables(planId, coupleMayAddTables);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function approveClientFloorPlanLayoutAction(
  planId: string, eventId: string,
): Promise<FloorPlanActionResult> {
  const result = await approveClientFloorPlanLayout(planId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function requestClientFloorPlanChangesAction(
  planId: string, eventId: string, note: string,
): Promise<FloorPlanActionResult> {
  const result = await requestClientFloorPlanChanges(planId, note);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

/**
 * Phase 2 — venue preference review (approve / decline / defer).
 * Approval does not change sharing. Seating assignments are never rewritten.
 */
export async function decideCoupleFloorPlanPreferenceAction(
  eventId: string,
  input:
    | { decision: "decline" }
    | { decision: "defer" }
    | { decision: "approve"; seatingChoice?: "start_on_preferred"; seatingInUseFloorPlanId?: string },
): Promise<FloorPlanActionResult> {
  const { decideCoupleFloorPlanPreference } = await import("@/lib/floor-plans/preference-service");
  const result = await decideCoupleFloorPlanPreference(eventId, input);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

/** Phase 2 — explicit seating-in-use designation (C1). */
export async function setSeatingInUseFloorPlanAction(
  eventId: string,
  floorPlanId: string | null,
): Promise<FloorPlanActionResult> {
  const { setSeatingInUseFloorPlan } = await import("@/lib/floor-plans/preference-service");
  const result = await setSeatingInUseFloorPlan(eventId, floorPlanId);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

// ── Phase 3 required setups ─────────────────────────────────────────────────

export async function listSetupsWithMembersAction(eventId: string) {
  const { listSetupsWithMembers } = await import("@/lib/floor-plans/setup-service");
  return listSetupsWithMembers(eventId);
}

export async function createRequiredSetupAction(eventId: string, name: string) {
  const { createRequiredSetup } = await import("@/lib/floor-plans/setup-service");
  const result = await createRequiredSetup(eventId, name);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

export async function renameRequiredSetupAction(eventId: string, setupId: string, name: string) {
  const { renameRequiredSetup } = await import("@/lib/floor-plans/setup-service");
  const result = await renameRequiredSetup(eventId, setupId, name);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

export async function removeRequiredSetupAction(eventId: string, setupId: string) {
  const { removeRequiredSetup } = await import("@/lib/floor-plans/setup-service");
  const result = await removeRequiredSetup(eventId, setupId);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

export async function attachLayoutToSetupAction(
  eventId: string,
  setupId: string,
  floorPlanId: string,
) {
  const { attachLayoutToSetup } = await import("@/lib/floor-plans/setup-service");
  const result = await attachLayoutToSetup(eventId, setupId, floorPlanId);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

export async function detachLayoutFromSetupAction(
  eventId: string,
  setupId: string,
  floorPlanId: string,
) {
  const { detachLayoutFromSetup } = await import("@/lib/floor-plans/setup-service");
  const result = await detachLayoutFromSetup(eventId, setupId, floorPlanId);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

export async function setSetupWorkingLayoutAction(
  eventId: string,
  setupId: string,
  floorPlanId: string,
) {
  const { setSetupWorkingLayout } = await import("@/lib/floor-plans/setup-service");
  const result = await setSetupWorkingLayout(eventId, setupId, floorPlanId);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}

export async function decideSetupFloorPlanPreferenceAction(
  eventId: string,
  setupId: string,
  input:
    | { decision: "decline" }
    | { decision: "defer" }
    | { decision: "approve"; seatingChoice?: "start_on_preferred"; seatingInUseFloorPlanId?: string },
): Promise<FloorPlanActionResult> {
  const { decideSetupFloorPlanPreference } = await import("@/lib/floor-plans/setup-service");
  const result = await decideSetupFloorPlanPreference(eventId, setupId, input);
  if (result.ok) {
    revalidateEvent(eventId);
    revalidateWorkspace(eventId);
  }
  return result;
}
