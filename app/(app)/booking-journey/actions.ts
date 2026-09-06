"use server";

import { revalidatePath } from "next/cache";

import { ensureCommercialCustomerForSelection } from "@/lib/booking-journey/ensure-commercial-customer";
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

/**
 * Explicit planning/workspace action — not required for contracts or payments.
 */
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

/**
 * Quietly ensure Client (+ Event when possible) so Create contract / Set up payments
 * work from a Lead without a manual workspace step. Never invites the portal.
 */
export async function ensureCommercialCustomerAction(input: {
  selectionId?: string;
  leadId?: string;
}): Promise<
  | { ok: true; clientId: string; eventId: string | null; selectionId: string }
  | { ok: false; message: string }
> {
  const result = await ensureCommercialCustomerForSelection(input);
  if (!result.ok) return result;
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  revalidatePath(`/clients/${result.clientId}`);
  return {
    ok: true,
    clientId: result.clientId,
    eventId: result.eventId,
    selectionId: result.selectionId,
  };
}

export async function prepareCreateContractAction(input: {
  selectionId: string;
  leadId?: string;
}): Promise<
  | { ok: true; href: string }
  | { ok: false; message: string }
> {
  const ensured = await ensureCommercialCustomerForSelection(input);
  if (!ensured.ok) return ensured;
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  revalidatePath(`/clients/${ensured.clientId}`);
  const params = new URLSearchParams();
  params.set("selectionId", ensured.selectionId);
  params.set("clientId", ensured.clientId);
  if (ensured.eventId) params.set("eventId", ensured.eventId);
  return { ok: true, href: `/contracts/new?${params.toString()}` };
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
