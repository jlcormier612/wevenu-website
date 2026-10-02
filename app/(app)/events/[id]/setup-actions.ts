"use server";

import { revalidatePath } from "next/cache";

import { collapseEventSetup, decideEventSetup, reopenEventSetup } from "@/lib/event-setup/service";
import type { EventSetupState } from "@/lib/event-setup/state";

function revalidateBooking(eventId: string, clientId: string | null) {
  revalidatePath(`/events/${eventId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export async function decideEventSetupAction(
  eventId: string,
  clientId: string | null,
  step: string,
  decision: string,
): Promise<{ ok: true; state: EventSetupState } | { ok: false; message: string }> {
  const result = await decideEventSetup(eventId, step, decision);
  if (result.ok) revalidateBooking(eventId, clientId);
  return result;
}

export async function reopenEventSetupAction(
  eventId: string,
  clientId: string | null,
): Promise<{ ok: true; state: EventSetupState } | { ok: false; message: string }> {
  const result = await reopenEventSetup(eventId);
  if (result.ok) revalidateBooking(eventId, clientId);
  return result;
}

export async function collapseEventSetupAction(
  eventId: string,
  clientId: string | null,
): Promise<{ ok: true; state: EventSetupState } | { ok: false; message: string }> {
  const result = await collapseEventSetup(eventId);
  if (result.ok) revalidateBooking(eventId, clientId);
  return result;
}
