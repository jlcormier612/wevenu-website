import { buildBookingJourney, type BookingJourneyModel, type JourneyContract, type JourneyProposal } from "@/lib/booking-journey/model";
import { proposalBrand } from "@/lib/booking-journey/proposal-view";
import {
  getActiveSelectedPackageForClient,
  getActiveSelectedPackageForLead,
} from "@/lib/commercial-selections/service";
import { resolveActiveProposal, resolveLatestWithdrawnProposal } from "@/lib/commercial-proposals/service";
import type { CommercialProposal } from "@/lib/commercial-proposals/types";
import { getClientInvitation } from "@/lib/client-auth/service";
import {
  getContractsForClient,
  getContractsForClientOrEvent,
} from "@/lib/contracts/service";
import { pickContract } from "@/lib/clients/booking-handoff";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { getEventPlaybookApplications } from "@/lib/playbooks/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";
import { createAdminClient } from "@/integrations/supabase/admin";
import { hasSuccessfulPaymentRequestSend } from "@/lib/invoices/outbound";
import type { Contract } from "@/lib/contracts/types";

async function paymentLinesForClient(clientId: string) {
  const schedules = (await getPaymentSchedules()).filter((s) => s.clientId === clientId);
  const details = await Promise.all(schedules.map((s) => getPaymentSchedule(s.id)));
  return details.flatMap((d) =>
    (d?.lineItems ?? []).map((line) => ({
      id: line.id,
      scheduleId: d!.id,
      obligationKind: line.obligationKind,
      status: line.status,
      amount: line.amount,
      paidAmount: line.paidAmount,
      dueDate: line.dueDate,
      label: line.label,
    })),
  );
}

async function paymentRequestSentForInvoice(invoiceId: string | null | undefined): Promise<boolean> {
  if (!invoiceId) return false;
  const venue = await getCurrentVenue();
  if (!venue) return false;
  return hasSuccessfulPaymentRequestSend(createAdminClient(), {
    venueId: venue.id,
    invoiceId,
  });
}

async function venuePrefs() {
  const venue = await getCurrentVenue();
  return venue?.commercialBookingPrefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
}

async function venueBrand() {
  const venue = await getCurrentVenue();
  return proposalBrand({
    primaryColor: venue?.primaryColor,
    secondaryColor: venue?.secondaryColor,
    accentColor: venue?.accentColor,
    neutralColor: venue?.neutralColor,
    logoUrl: venue?.logoUrl,
  });
}

async function venueName(): Promise<string | null> {
  const venue = await getCurrentVenue();
  return venue?.name ?? null;
}

function bestContract(clientId: string | null | undefined, contracts: Contract[]): JourneyContract | null {
  if (!clientId) return null;
  const owned = contracts.filter((c) => c.clientId === clientId);
  const picked = pickContract(owned.map((c) => ({ id: c.id, status: c.status, executionOrigin: c.executionOrigin })));
  if (!picked) return null;
  const full = owned.find((c) => c.id === picked.id);
  return {
    id: picked.id,
    status: picked.status,
    venueSigned: full?.venueSigned ?? false,
    requiredClientTotal: full?.requiredClientTotal ?? 0,
    requiredClientSigned: full?.requiredClientSigned ?? 0,
  };
}

/** Never pull venue-wide contracts into a single-lead journey. */
async function contractsForLeadJourney(
  clientId: string | null,
  eventId: string | null,
): Promise<Contract[]> {
  if (!clientId) return [];
  if (eventId) return getContractsForClientOrEvent(clientId, eventId);
  return getContractsForClient(clientId);
}

function toJourneyProposal(p: CommercialProposal | null): JourneyProposal | null {
  if (!p) return null;
  return {
    id: p.id,
    status: p.status,
    offeredAt: p.offeredAt,
    acceptToken: p.acceptToken,
    selectionId: p.selectionId,
  };
}

export async function loadBookingJourneyForLead(input: {
  leadId: string;
  linkedClientId?: string | null;
  linkedEventId?: string | null;
}): Promise<BookingJourneyModel> {
  const [selection, proposal] = await Promise.all([
    getActiveSelectedPackageForLead(input.leadId),
    resolveActiveProposal({ leadId: input.leadId, clientId: input.linkedClientId ?? undefined }).then(async (active) =>
      active ?? resolveLatestWithdrawnProposal({ leadId: input.leadId, clientId: input.linkedClientId ?? undefined }),
    ),
  ]);
  let clientSelection = selection;
  if (!clientSelection && input.linkedClientId) {
    clientSelection = await getActiveSelectedPackageForClient(input.linkedClientId);
  }
  const clientId = input.linkedClientId ?? clientSelection?.clientId ?? null;
  const eventId = input.linkedEventId ?? clientSelection?.eventId ?? null;
  const [contracts, paymentLines, invitation, applications, prefs, brand, name, paymentRequestSent] = await Promise.all([
    contractsForLeadJourney(clientId, eventId),
    clientId ? paymentLinesForClient(clientId) : Promise.resolve([]),
    clientId ? getClientInvitation(clientId) : Promise.resolve(null),
    eventId ? getEventPlaybookApplications(eventId) : Promise.resolve([]),
    venuePrefs(),
    venueBrand(),
    venueName(),
    paymentRequestSentForInvoice(clientSelection?.invoiceId),
  ]);
  return buildBookingJourney({
    leadId: input.leadId,
    clientId,
    eventId,
    selection: clientSelection,
    proposal: toJourneyProposal(proposal),
    contract: bestContract(clientId, contracts),
    paymentLines,
    paymentRequestSent,
    portalInvited: Boolean(invitation && invitation.status !== "revoked"),
    planningStarted: applications.some((a) => !!a.releasedAt),
    prefs,
    brand,
    venueName: name,
  });
}

export async function loadBookingJourneyForClient(input: {
  clientId: string;
  eventId?: string | null;
  leadId?: string | null;
}): Promise<BookingJourneyModel> {
  // Prefer client|event scope; fall back to client-only — never venue-wide.
  const contractsPromise = input.eventId
    ? getContractsForClientOrEvent(input.clientId, input.eventId)
    : getContractsForClient(input.clientId);
  const [selection, contracts, paymentLines, invitation, applications, prefs, brand, name, proposal] = await Promise.all([
    getActiveSelectedPackageForClient(input.clientId),
    contractsPromise,
    paymentLinesForClient(input.clientId),
    getClientInvitation(input.clientId),
    input.eventId ? getEventPlaybookApplications(input.eventId) : Promise.resolve([]),
    venuePrefs(),
    venueBrand(),
    venueName(),
    resolveActiveProposal({ clientId: input.clientId, leadId: input.leadId ?? undefined }).then(async (active) =>
      active ?? resolveLatestWithdrawnProposal({ clientId: input.clientId, leadId: input.leadId ?? undefined }),
    ),
  ]);
  let resolved = selection;
  if (!resolved && input.leadId) {
    resolved = await getActiveSelectedPackageForLead(input.leadId);
  }
  return buildBookingJourney({
    leadId: input.leadId,
    clientId: input.clientId,
    eventId: input.eventId ?? resolved?.eventId,
    selection: resolved,
    proposal: toJourneyProposal(proposal),
    contract: bestContract(input.clientId, contracts),
    paymentLines,
    paymentRequestSent: await paymentRequestSentForInvoice(resolved?.invoiceId),
    portalInvited: Boolean(invitation && invitation.status !== "revoked"),
    planningStarted: applications.some((a) => !!a.releasedAt),
    prefs,
    brand,
    venueName: name,
  });
}
