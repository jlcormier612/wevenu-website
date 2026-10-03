import { decisionValue, getEventSetupState, saveEventSetupState } from "@/lib/event-setup/repository";
import {
  applicableSetupSteps,
  emptyEventSetupState,
  isSetupStepKey,
  withProfileOverride,
  withSetupCollapsed,
  withSetupDecision,
  withSetupReopened,
  type EventSetupState,
  type SetupDecision,
} from "@/lib/event-setup/state";
import type { VenuePlanningCapabilities } from "@/lib/playbooks/capabilities";
import { getCurrentVenue } from "@/lib/venue/service";

function capabilitiesForVenue(venue: {
  planningTimelineEnabled: boolean;
  planningFloorPlanEnabled: boolean;
  planningSeatingEnabled: boolean;
  planningVendorsEnabled: boolean;
}): VenuePlanningCapabilities {
  return {
    timeline: venue.planningTimelineEnabled,
    floorPlan: venue.planningFloorPlanEnabled,
    seating: venue.planningSeatingEnabled,
    vendors: venue.planningVendorsEnabled,
  };
}

async function venueContext(): Promise<{ venueId: string; applicable: ReturnType<typeof applicableSetupSteps> } | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return { venueId: venue.id, applicable: applicableSetupSteps(capabilitiesForVenue(venue)) };
}

export async function loadEventSetup(eventId: string): Promise<EventSetupState> {
  const ctx = await venueContext();
  if (!ctx) return emptyEventSetupState();
  return getEventSetupState(ctx.venueId, eventId);
}

export async function decideEventSetup(
  eventId: string,
  step: string,
  decision: string,
): Promise<{ ok: true; state: EventSetupState } | { ok: false; message: string }> {
  if (!isSetupStepKey(step)) return { ok: false, message: "Unknown setup step." };
  const chosen = decisionValue(decision);
  if (!chosen) return { ok: false, message: "Choose set up or skip." };
  const ctx = await venueContext();
  if (!ctx) return { ok: false, message: "No venue found." };
  if (!ctx.applicable.includes(step)) return { ok: false, message: "This venue does not use that step." };
  const current = await getEventSetupState(ctx.venueId, eventId);
  const next = current.usesProfile
    ? withProfileOverride(current, ctx.applicable, step, chosen as SetupDecision)
    : withSetupDecision(current, ctx.applicable, step, chosen as SetupDecision);
  const state = await saveEventSetupState(ctx.venueId, eventId, next);
  return { ok: true, state };
}

export async function reopenEventSetup(
  eventId: string,
): Promise<{ ok: true; state: EventSetupState } | { ok: false; message: string }> {
  const ctx = await venueContext();
  if (!ctx) return { ok: false, message: "No venue found." };
  const current = await getEventSetupState(ctx.venueId, eventId);
  const state = await saveEventSetupState(ctx.venueId, eventId, withSetupReopened(current));
  return { ok: true, state };
}

export async function collapseEventSetup(
  eventId: string,
): Promise<{ ok: true; state: EventSetupState } | { ok: false; message: string }> {
  const ctx = await venueContext();
  if (!ctx) return { ok: false, message: "No venue found." };
  const current = await getEventSetupState(ctx.venueId, eventId);
  const state = await saveEventSetupState(ctx.venueId, eventId, withSetupCollapsed(current));
  return { ok: true, state };
}
