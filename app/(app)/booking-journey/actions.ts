"use server";

import { revalidatePath } from "next/cache";

import {
  attachSelectionToBookingFile,
  createSelectedPackageFromLibrary,
  getSelectedPackage,
  linkSelectionContract,
  markSelectionAccepted,
  sendOfferForSelection,
} from "@/lib/commercial-selections/service";
import type {
  CommercialSelectionActionResult,
  CreateCommercialSelectionResult,
} from "@/lib/commercial-selections/types";
import { convertLeadToClient } from "@/lib/clients/service";
import type { CreateClientResult } from "@/lib/clients/types";
import type { Lead } from "@/lib/leads/types";
import { publicAppOrigin } from "@/lib/env";

export async function createSelectedPackageAction(input: {
  packageId: string;
  leadId?: string;
  clientId?: string;
  eventId?: string;
  depositAmount?: number;
}): Promise<CreateCommercialSelectionResult> {
  const result = await createSelectedPackageFromLibrary(input);
  if (result.ok) {
    if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
    if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
    if (input.eventId) revalidatePath(`/events/${input.eventId}`);
  }
  return result;
}

export async function startBookingFileAction(
  lead: Lead,
  spaceId?: string,
  selectionId?: string,
): Promise<CreateClientResult> {
  const result = await convertLeadToClient(lead, { spaceId });
  if (result.ok) {
    if (selectionId) {
      await attachSelectionToBookingFile(selectionId, {
        clientId: result.clientId,
        eventId: result.eventId,
        leadId: lead.id,
      });
    } else {
      // Attach any active lead selection that exists
      const { getActiveSelectedPackageForLead } = await import("@/lib/commercial-selections/service");
      const active = await getActiveSelectedPackageForLead(lead.id);
      if (active) {
        await attachSelectionToBookingFile(active.id, {
          clientId: result.clientId,
          eventId: result.eventId,
          leadId: lead.id,
        });
      }
    }
    revalidatePath("/clients");
    revalidatePath(`/leads/${lead.id}`);
    revalidatePath(`/clients/${result.clientId}`);
  }
  return result;
}

export async function sendOfferAction(input: {
  selectionId: string;
  message?: string;
  leadId?: string;
  clientId?: string;
}): Promise<
  | { ok: true; acceptUrl: string }
  | CommercialSelectionActionResult
> {
  const result = await sendOfferForSelection({
    selectionId: input.selectionId,
    message: input.message,
  });
  if (!result.ok || !("acceptToken" in result)) return result;
  const acceptUrl = `${publicAppOrigin()}/offer/${result.acceptToken}`;
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
  revalidatePath(`/leads`);
  return { ok: true, acceptUrl };
}

export async function markOfferAcceptedAction(input: {
  selectionId: string;
  leadId?: string;
  clientId?: string;
}): Promise<CommercialSelectionActionResult> {
  const result = await markSelectionAccepted(input.selectionId);
  if (result.ok) {
    if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
    if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
  }
  return result;
}

export async function linkContractToSelectionAction(
  selectionId: string,
  contractId: string,
): Promise<CommercialSelectionActionResult> {
  const result = await linkSelectionContract(selectionId, contractId);
  const sel = await getSelectedPackage(selectionId);
  if (sel?.clientId) revalidatePath(`/clients/${sel.clientId}`);
  if (sel?.leadId) revalidatePath(`/leads/${sel.leadId}`);
  revalidatePath(`/contracts/${contractId}`);
  return result;
}
