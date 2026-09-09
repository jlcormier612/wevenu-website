import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { BookingCelebration } from "@/components/clients/booking-celebration";
import { buildBookingHandoff } from "@/lib/clients/booking-handoff";
import { buildCommunicationsReview } from "@/lib/clients/communications-review";
import { buildEventExperienceReview } from "@/lib/clients/event-experience-review";
import { buildFinancialReadiness } from "@/lib/clients/financial-readiness";
import { loadBookingJourneyForClient } from "@/lib/booking-journey/load";
import { remainingAmount } from "@/lib/commercial-selections/constants";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { getClientInvitation } from "@/lib/client-auth/service";
import { getContracts } from "@/lib/contracts/service";
import { getEvent } from "@/lib/events/service";
import { formatCurrency } from "@/lib/invoices/constants";
import { getActiveEnrollmentsForRelationship, getSequences } from "@/lib/message-sequences/service";
import { getPaymentSchedule, getPaymentSchedules } from "@/lib/payments/service";
import { getEventPlaybookApplications, getTemplates } from "@/lib/playbooks/service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ eventId?: string; invited?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Booking complete" };
  return {
    title: `Booked · ${clientDisplayName(client.firstName, client.lastName)}`,
  };
}

export default async function BookedPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { eventId } = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();
  const resolvedEventId = eventId ?? client.linkedEventId ?? null;

  const journey = await loadBookingJourneyForClient({
    clientId: client.id,
    eventId: resolvedEventId,
    leadId: client.leadId,
  });

  // Venue-facing Booked celebration only after agreement + deposit paid.
  if (!journey.isCommerciallyBooked) {
    redirect(`/clients/${client.id}`);
  }

  const [invitation, applications, contracts, schedules, templates, event, automations, enrollments] = await Promise.all([
    getClientInvitation(client.id),
    resolvedEventId ? getEventPlaybookApplications(resolvedEventId) : Promise.resolve([]),
    getContracts(),
    getPaymentSchedules(),
    getTemplates(),
    resolvedEventId ? getEvent(resolvedEventId) : Promise.resolve(null),
    getSequences(),
    client.relationshipId
      ? getActiveEnrollmentsForRelationship(client.relationshipId)
      : Promise.resolve([]),
  ]);

  const clientContracts = contracts
    .filter((c) => c.clientId === client.id)
    .map((c) => ({ id: c.id, status: c.status, executionOrigin: c.executionOrigin }));
  const clientSchedules = schedules
    .filter((s) => s.clientId === client.id)
    .map((s) => ({ id: s.id, title: s.title }));
  const scheduleDetails = await Promise.all(clientSchedules.map((s) => getPaymentSchedule(s.id)));
  const paymentLines = scheduleDetails.flatMap((detail) =>
    (detail?.lineItems ?? []).map((line) => ({
      scheduleId: line.scheduleId,
      obligationKind: line.obligationKind,
      status: line.status,
      sortOrder: line.sortOrder,
    })),
  );
  const financial = buildFinancialReadiness({
    contracts: clientContracts,
    paymentSchedules: clientSchedules,
    paymentLines,
  });
  const communications = buildCommunicationsReview({
    clientId: client.id,
    invitation: invitation ? { status: invitation.status } : null,
    clientHasEmail: Boolean(client.email?.trim()),
    automations: automations.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      triggerType: a.triggerType,
      triggerStage: a.triggerStage,
    })),
    activeEnrollmentSequenceIds: enrollments.map((e) => e.sequenceId),
  });
  const experience = buildEventExperienceReview({
    clientId: client.id,
    eventId: resolvedEventId,
    eventType: event?.eventType ?? null,
    clientEventType: client.eventType,
  });

  const selection = journey.selection;
  const remaining = selection
    ? remainingAmount(selection.totalAmount, selection.depositAmount)
    : null;

  const handoff = buildBookingHandoff({
    clientId: client.id,
    eventId: resolvedEventId,
    playbookApplications: applications.map((a) => ({
      kind: a.kind,
      releasedAt: a.releasedAt,
      templateName: a.templateName,
    })),
    financialSummary: financial.summary,
    communicationsSummary: communications.summary,
    experienceSummary: experience.summary,
  });

  // Override celebration copy for commercial Booked (agreement + deposit).
  handoff.eyebrow = "They're Booked";
  handoff.bookingLine = selection
    ? `${selection.name} · ${formatCurrency(selection.totalAmount)} · Deposit ${formatCurrency(selection.depositAmount)} received · ${formatCurrency(remaining ?? 0)} remaining`
    : "Agreement complete and deposit received.";
  handoff.prepareHeading = "What to do next";
  handoff.tagline =
    "Client Planning is optional and separate. Invite them to the portal and release planning only when those are ready — Booked does not mean planning is released.";
  handoff.primaryLabel = "Continue to booking";
  handoff.primaryHref = `/clients/${client.id}`;

  return (
    <BookingCelebration
      client={client}
      eventId={resolvedEventId}
      eventDate={event?.eventDate ?? client.eventDate}
      eventType={event?.eventType ?? client.eventType}
      templates={templates}
      applications={applications}
      handoff={handoff}
      financial={financial}
      communications={communications}
      experience={experience}
    />
  );
}
