import { buildBookingJourney, type BookingJourneyModel, type JourneyContract } from "@/lib/booking-journey/model";
import {
  getActiveSelectedPackageForClient,
  getActiveSelectedPackageForLead,
} from "@/lib/commercial-selections/service";
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

export async function loadBookingJourneyForLead(input: {
  leadId: string;
  linkedClientId?: string | null;
  linkedEventId?: string | null;
}): Promise<BookingJourneyModel> {
  const [selection, contracts] = await Promise.all([
    getActiveSelectedPackageForLead(input.leadId),
    getContracts(),
  ]);
  let clientSelection = selection;
  if (!clientSelection && input.linkedClientId) {
    clientSelection = await getActiveSelectedPackageForClient(input.linkedClientId);
  }
  const clientId = input.linkedClientId ?? clientSelection?.clientId ?? null;
  const eventId = input.linkedEventId ?? clientSelection?.eventId ?? null;
  const [paymentLines, invitation, applications, prefs] = await Promise.all([
    clientId ? paymentLinesForClient(clientId) : Promise.resolve([]),
    clientId ? getClientInvitation(clientId) : Promise.resolve(null),
    eventId ? getEventPlaybookApplications(eventId) : Promise.resolve([]),
    venuePrefs(),
  ]);
  return buildBookingJourney({
    leadId: input.leadId,
    clientId,
    eventId,
    selection: clientSelection,
    contract: bestContract(clientId, contracts),
    paymentLines,
    portalInvited: Boolean(invitation && invitation.status !== "revoked"),
    planningStarted: applications.some((a) => !!a.releasedAt),
    prefs,
  });
}

export async function loadBookingJourneyForClient(input: {
  clientId: string;
  eventId?: string | null;
  leadId?: string | null;
}): Promise<BookingJourneyModel> {
  const [selection, contracts, paymentLines, invitation, applications, prefs] = await Promise.all([
    getActiveSelectedPackageForClient(input.clientId),
    getContracts(),
    paymentLinesForClient(input.clientId),
    getClientInvitation(input.clientId),
    input.eventId ? getEventPlaybookApplications(input.eventId) : Promise.resolve([]),
    venuePrefs(),
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
    contract: bestContract(input.clientId, contracts),
    paymentLines,
    portalInvited: Boolean(invitation && invitation.status !== "revoked"),
    planningStarted: applications.some((a) => !!a.releasedAt),
    prefs,
  });
}
