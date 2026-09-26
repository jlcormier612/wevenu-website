import { buildBookingJourney, type BookingJourneyModel, type JourneyContract, type JourneyProposal } from "@/lib/booking-journey/model";
import {
  getActiveSelectedPackageForClient,
  getActiveSelectedPackageForLead,
} from "@/lib/commercial-selections/service";
import { resolveActiveProposal, resolveLatestWithdrawnProposal } from "@/lib/commercial-proposals/service";
import type { CommercialProposal } from "@/lib/commercial-proposals/types";
import { getClientInvitation } from "@/lib/client-auth/service";
import { getContracts } from "@/lib/contracts/service";
import { pickContract } from "@/lib/clients/booking-handoff";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { getEventPlaybookApplications } from "@/lib/playbooks/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";

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
      dueDate: line.dueDate,
    })),
  );
}

async function venuePrefs() {
  const venue = await getCurrentVenue();
  return venue?.commercialBookingPrefs ?? DEFAULT_COMMERCIAL_BOOKING_PREFS;
}

async function venueBrand() {
  const venue = await getCurrentVenue();
  return {
    primaryColor: venue?.primaryColor || "#5D6F5D",
    secondaryColor: venue?.secondaryColor || "#4F5F4F",
    accentColor: venue?.accentColor || "#B8AEA1",
    neutralColor: venue?.neutralColor || "#F7F5F1",
  };
}

async function venueName(): Promise<string | null> {
  const venue = await getCurrentVenue();
  return venue?.name ?? null;
}

function bestContract(clientId: string | null | undefined, contracts: Awaited<ReturnType<typeof getContracts>>): JourneyContract | null {
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
  const [selection, contracts, proposal] = await Promise.all([
    getActiveSelectedPackageForLead(input.leadId),
    getContracts(),
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
  const [paymentLines, invitation, applications, prefs, brand, name] = await Promise.all([
    clientId ? paymentLinesForClient(clientId) : Promise.resolve([]),
    clientId ? getClientInvitation(clientId) : Promise.resolve(null),
    eventId ? getEventPlaybookApplications(eventId) : Promise.resolve([]),
    venuePrefs(),
    venueBrand(),
    venueName(),
  ]);
  return buildBookingJourney({
    leadId: input.leadId,
    clientId,
    eventId,
    selection: clientSelection,
    proposal: toJourneyProposal(proposal),
    contract: bestContract(clientId, contracts),
    paymentLines,
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
  const [selection, contracts, paymentLines, invitation, applications, prefs, brand, name, proposal] = await Promise.all([
    getActiveSelectedPackageForClient(input.clientId),
    getContracts(),
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
    portalInvited: Boolean(invitation && invitation.status !== "revoked"),
    planningStarted: applications.some((a) => !!a.releasedAt),
    prefs,
    brand,
    venueName: name,
  });
}
