/**
 * Quietly ensure a commercial customer (Client + Event when date exists) for
 * contracts/payments. Does not invite the portal or start planning.
 * Idempotent — reuses an existing linked Client.
 */

import { convertLeadToClient } from "@/lib/clients/service";
import {
  attachSelectionToBookingFile,
  getActiveSelectedPackageForLead,
  getSelectedPackage,
} from "@/lib/commercial-selections/service";
import { getLead } from "@/lib/leads/service";

export type EnsureCommercialCustomerResult =
  | { ok: true; clientId: string; eventId: string | null; selectionId: string; created: boolean }
  | { ok: false; message: string };

export async function ensureCommercialCustomerForSelection(input: {
  selectionId?: string;
  leadId?: string;
  /** Optional Event Space — used when creating a dated Event on multi-space venues. */
  spaceId?: string;
}): Promise<EnsureCommercialCustomerResult> {
  let selection = input.selectionId
    ? await getSelectedPackage(input.selectionId)
    : null;
  const leadId = input.leadId ?? selection?.leadId ?? undefined;

  if (!selection && leadId) {
    selection = await getActiveSelectedPackageForLead(leadId);
  }
  if (!selection) {
    return { ok: false, message: "Select a package first." };
  }
  if (selection.status === "superseded") {
    return { ok: false, message: "This selected package was replaced. Choose a package again." };
  }

  if (selection.clientId) {
    return {
      ok: true,
      clientId: selection.clientId,
      eventId: selection.eventId,
      selectionId: selection.id,
      created: false,
    };
  }

  if (!leadId) {
    return { ok: false, message: "A lead is required to continue." };
  }

  const lead = await getLead(leadId);
  if (!lead) {
    return { ok: false, message: "Lead not found." };
  }

  // Client already exists for this lead (e.g. prior quiet ensure) but selection
  // was never linked — attach and reuse; do not create a duplicate.
  if (lead.linkedClientId) {
    await attachSelectionToBookingFile(selection.id, {
      clientId: lead.linkedClientId,
      eventId: lead.linkedEventId,
      leadId,
    });
    return {
      ok: true,
      clientId: lead.linkedClientId,
      eventId: lead.linkedEventId,
      selectionId: selection.id,
      created: false,
    };
  }

  // Reuse convertLeadToClient — creates Client (+ Event when a date exists and
  // space is available), never invites the portal (invitationSent is always false).
  // commercialOnly keeps the lead on the sales pipeline (does not set sales
  // Booked / stamp booked_at) — Start booking file remains the explicit planning step.
  const converted = await convertLeadToClient(lead, {
    commercialOnly: true,
    spaceId: input.spaceId,
  });
  if (!converted.ok) {
    return { ok: false, message: converted.message ?? "Could not continue." };
  }

  await attachSelectionToBookingFile(selection.id, {
    clientId: converted.clientId,
    eventId: converted.eventId,
    leadId,
  });

  return {
    ok: true,
    clientId: converted.clientId,
    eventId: converted.eventId,
    selectionId: selection.id,
    created: true,
  };
}
