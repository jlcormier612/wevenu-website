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
import { getCurrentVenue } from "@/lib/venue/service";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";

export async function createSelectedPackageAction(input: {
  packageId: string;
  leadId?: string;
  clientId?: string;
  eventId?: string;
  depositAmount?: number;
}): Promise<CreateCommercialSelectionResult> {
  const venue = await getCurrentVenue();
  const prefs = venue?.commercialBookingPrefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
  const result = await createSelectedPackageFromLibrary({
    ...input,
    depositAmount: prefs.initialPaymentRequired ? input.depositAmount : 0,
    initialPaymentRequired: prefs.initialPaymentRequired,
  });
  if (result.ok) {
    if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
    if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
    if (input.eventId) revalidatePath(`/events/${input.eventId}`);
  }
  return result;
}

/**
 * Canonical Lead → booking-file workspace.
 * Creates Client (+ Event when applicable) and attaches the selected package.
 * Does not mark the relationship commercially Booked, set pipeline Booked,
 * stamp lifecycle booking dates, or invite the portal.
 */
export async function startBookingFileAction(
  lead: Lead,
  spaceId?: string,
  selectionId?: string,
): Promise<CreateClientResult> {
  const resolvedSpace = spaceId?.trim() || lead.plannedEventSpaceId || undefined;
  const result = await convertLeadToClient(lead, { spaceId: resolvedSpace });
  if (!result.ok) return result;

  let warning: string | undefined;
  const attachId = selectionId
    ?? (await import("@/lib/commercial-selections/service").then((m) =>
      m.getActiveSelectedPackageForLead(lead.id),
    ).then((s) => s?.id ?? null));

  if (attachId) {
    const attached = await attachSelectionToBookingFile(attachId, {
      clientId: result.clientId,
      eventId: result.eventId,
      leadId: lead.id,
    });
    if (!attached.ok) {
      warning =
        attached.message
          ? `Booking file started, but the selected package could not be linked: ${attached.message}. Open the booking file and select the package again.`
          : "Booking file started, but the selected package could not be linked. Open the booking file and select the package again.";
    }
  }

  revalidatePath("/clients");
  revalidatePath(`/leads/${lead.id}`);
  revalidatePath(`/clients/${result.clientId}`);
  return {
    ok: true,
    clientId: result.clientId,
    eventId: result.eventId,
    invitationSent: false,
    warning,
  };
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
  spaceId?: string;
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

export async function createProposalAction(input: {
  leadId?: string;
  clientId?: string;
  eventId?: string;
  options: { packageId: string; offerRole: "primary" | "addon" }[];
  depositAmount?: number;
  message?: string;
  eventType?: string | null;
  guestCount?: number | null;
  spaceId?: string | null;
}): Promise<{ ok: true; proposalId: string } | { ok: false; message: string }> {
  const { createCommercialProposal } = await import("@/lib/commercial-proposals/service");
  const result = await createCommercialProposal({
    leadId: input.leadId,
    clientId: input.clientId,
    eventId: input.eventId,
    options: input.options,
    depositAmount: input.depositAmount,
    message: input.message,
    eligibilityContext: {
      eventType: input.eventType,
      guestCount: input.guestCount,
      spaceId: input.spaceId,
    },
  });
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Could not create the proposal." };
  }
  if (!("proposalId" in result) || !result.proposalId) {
    return { ok: false, message: "Could not create the proposal." };
  }
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
  return { ok: true, proposalId: result.proposalId };
}

export async function sendProposalAction(input: {
  proposalId: string;
  message?: string;
  leadId?: string;
  clientId?: string;
}): Promise<{ ok: true; acceptUrl: string } | { ok: false; message: string }> {
  const { sendCommercialProposal } = await import("@/lib/commercial-proposals/service");
  const result = await sendCommercialProposal({
    proposalId: input.proposalId,
    message: input.message,
  });
  if (!result.ok || !("acceptToken" in result)) {
    return { ok: false, message: result.ok === false ? result.message : "Could not send proposal." };
  }
  const acceptUrl = `${publicAppOrigin()}/offer/${result.acceptToken}`;
  if (input.leadId) revalidatePath(`/leads/${input.leadId}`);
  if (input.clientId) revalidatePath(`/clients/${input.clientId}`);
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
