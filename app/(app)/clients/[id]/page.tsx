import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DeleteClientRecordButton } from "@/components/clients/delete-client-record-button";
import { BookingJourneyPanel } from "@/components/booking-journey/booking-journey-panel";
import { EventTaskList } from "@/components/playbooks/event-task-list";
import { TimelineView } from "@/components/events/timeline/timeline-view";
import { FloorPlanWorkspace } from "@/components/events/floor-plan-workspace";
import { EventOrderPanel } from "@/components/event-orders/event-order-panel";
import { EventVendorsSection } from "@/components/events/vendors/event-vendors-section";
import { getClientTasks } from "@/lib/playbooks/service";
import { getClientTimelineEntries, getClientSections } from "@/lib/timeline/service";
import { getFloorPlansForClient } from "@/lib/floor-plans/service";
import { getEventOrderForClient } from "@/lib/event-orders/service";
import { getClientVendorAssignments } from "@/lib/vendors/service";
import { buildInternalNotesRollup } from "@/lib/notes/internal-notes-rollup";
import type { LinkableConversationMessage } from "@/components/playbooks/event-task-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getSpaces } from "@/lib/availability/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { getConversation, getConversationIdForRelationship } from "@/lib/conversations/service";
import type { ConversationMessage } from "@/lib/conversations/types";
import {
  getContractsForClientOrEvent,
  getTemplatesMetadata as getContractTemplates,
} from "@/lib/contracts/service";
import { getDocuments, getEventDocumentsFromVendors } from "@/lib/documents/service";
import { getPinnedDocumentKeys, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import { getEvent } from "@/lib/events/service";
import { getEventSpaceAssignments } from "@/lib/events/space-assignments";
import { formatEventSpaceAssignmentsDisplay } from "@/lib/venue-spaces/uses";
import { getQuestionnaires, getQuestionnaireActivities } from "@/lib/events/questionnaire";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getEventFloorPlanOffers } from "@/lib/floor-plan-offers/service";
import { getGuestReadinessSummary } from "@/lib/guests/service";
import { getUsageForEvent } from "@/lib/inventory/service";
import { getInvoiceLineMarkers, getInvoicesForClientOrEvent } from "@/lib/invoices/service";
import {
  frozenEventOrderLineIds,
  packageBookingCommitmentInvoiceIds,
} from "@/lib/invoices/booking-commitment";
import { buildSelectionsFinancialImpact } from "@/lib/client-choices/selections-billing";
import { getPaymentSchedules } from "@/lib/payments/service";
import {
  getEventPlaybookApplications, getClientPlaybookApplications, getEventTaskContextLinksForEvent, getEventTaskReadinessByKind,
  getEventTasks, getTaskContactsByStaffIds, getTemplatesForLibrary,
} from "@/lib/playbooks/service";
import { getPortalSessions } from "@/lib/portal/service";
import { buildEventReadiness } from "@/lib/readiness/compute";
import { getRequests, getRequestsByIds } from "@/lib/requests/service";
import type { Request } from "@/lib/requests/types";
import { getSeatingReadinessSummary } from "@/lib/seating/service";
import { getTeamMembers } from "@/lib/team/service";
import {
  getEntryAttachmentsForEvent, getEntryLinksForEvent, getRelatedLinksForEvent, getSections, getTimelineEntries,
} from "@/lib/timeline/service";
import { getTemplatesForLibrary as getTimelineTemplatesForLibrary } from "@/lib/timeline-templates/service";
import { LEAD_SOURCES } from "@/lib/leads/constants";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import {
  canDeleteFloorPlanRows,
  canEditFloorPlans,
} from "@/lib/floor-plans/authorize";
import { getEventRecommendations } from "@/lib/vendor-recommendations/service";
import { getVendors } from "@/lib/vendors/service";
import { getEventOrder } from "@/lib/event-orders/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import {
  getClientChoices,
  listClientChoicesForEvent,
} from "@/lib/client-choices/service";
import { listActiveOfferings } from "@/lib/offerings/service";
import { getPackages, getPackagesWithItems } from "@/lib/packages/service";
import { bookingCelebrationPending } from "@/lib/booking-journey/booking-celebration";
import { loadBookingJourneyForClient } from "@/lib/booking-journey/load";
import { getActiveSelectedPackageForClient } from "@/lib/commercial-selections/service";
import { getItems as getInventoryItems } from "@/lib/inventory/service";
import { getEventInventory, getTemplates as getInventoryTemplates } from "@/lib/event-inventory/service";
import { getRelationshipPhotoForVenue } from "@/lib/relationship-photos/service";
import { RelationshipPhotoAvatar } from "@/components/relationship-photos/relationship-photo-avatar";
import { getContextualObservationsForRecord } from "@/lib/luv/contextual-record";
import { loadEventSetup } from "@/lib/event-setup/service";
import { applicableSetupSteps } from "@/lib/event-setup/state";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ setupPayments?: string; selectionId?: string; eventId?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) return { title: "Booking not found" };
  return { title: clientDisplayName(client.firstName, client.lastName) };
}

/**
 * The Booking Workspace. A Booking is a Client with its linked Event's
 * existing workspace (Planning, Timeline, Vendors, Payments, Messages,
 * Documents, Notes, Team, Feedback) — reusing EventDetail exactly as it
 * already existed under /events/[id], just resolved from the Client side.
 */
export default async function BookingWorkspacePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();

  if (!client.linkedEventId) {
    const displayName = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);
    // Slice 2 — photo is independent of the rest of the unbooked workspace reads.
    const [
      photo, journey, packagesWithItems, packageList, templates, applications, tasks,
      timelineEntries, timelineSections, timelineTemplates, venue, spaces,
      floorPlans, floorPlanTemplates, vendors, vendorAssignments, eventOrder, eventOrderTemplates,
      offerings, inventoryItems, staffRole,
    ] = await Promise.all([
      client.relationshipId
        ? getRelationshipPhotoForVenue(client.relationshipId)
        : Promise.resolve(null),
      loadBookingJourneyForClient({
        clientId: client.id,
        eventId: null,
        leadId: client.leadId,
      }),
      getPackagesWithItems(true),
      getPackages(true),
      getTemplatesForLibrary(),
      getClientPlaybookApplications(client.id),
      getClientTasks(client.id),
      getClientTimelineEntries(client.id),
      getClientSections(client.id),
      getTimelineTemplatesForLibrary(),
      getCurrentVenue(),
      getSpaces(),
      getFloorPlansForClient(client.id),
      getFloorPlanTemplates(),
      getVendors(),
      getClientVendorAssignments(client.id),
      getEventOrderForClient(client.id),
      getEventOrderTemplates(),
      listActiveOfferings(),
      getInventoryItems(),
      getCurrentUserRole(),
    ]);
    const activeTimelineTemplates = timelineTemplates.filter((t) => !t.isArchived);
    const activePlaybookTemplates = templates.filter((t) => !t.isArchived);
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <RelationshipPhotoAvatar photoUrl={photo?.displayedPhotoUrl ?? null} name={displayName} size="lg" />
            <PageHeader
              title={displayName}
              description="You are preparing this client's planning workspace. Preparing the workspace does not reserve their date."
            />
          </div>
          <DeleteClientRecordButton clientId={client.id} fallbackName={displayName} />
        </div>
        <p className="text-sm text-muted-foreground">
          {client.eventDate
            ? `Preferred date: ${client.eventDate}. This is a preference, not a reservation.`
            : "No preferred date yet. A preferred date does not reserve a date."}
        </p>
        <BookingJourneyPanel
          journey={journey}
          packages={packagesWithItems}
          leadId={client.leadId ?? undefined}
          clientId={client.id}
          eventDate={client.eventDate}
          venueTimezone={venue?.timezone ?? null}
          workspaceReturnTo={`/clients/${client.id}`}
        />
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Checklists</h2>
          <EventTaskList
            eventId=""
            clientId={client.id}
            eventDate={client.eventDate ?? ""}
            eventName={displayName}
            clientName={displayName}
            eventType={client.eventType}
            initialTasks={tasks}
            readinessByKind={{ client: null, venue: null }}
            templates={activePlaybookTemplates}
            applications={applications}
            contextLinksByTask={{}}
            taskContacts={{}}
            linkableDocuments={[]}
            linkableTimelineEntries={timelineEntries}
            linkableConversationMessages={[]}
            staffOptions={[]}
          />
        </section>
        <section id="timeline" className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Timeline</h2>
          <p className="text-sm text-muted-foreground">
            Draft the day before you book. This does not reserve the preferred date.
          </p>
          <TimelineView
            eventId=""
            planningClientId={client.id}
            venueId={venue?.id ?? ""}
            eventStartTime={null}
            eventDate={client.eventDate}
            initialEntries={timelineEntries}
            initialSections={timelineSections}
            timelineTemplates={activeTimelineTemplates}
          />
        </section>
        <section id="floorplan" className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Floor plans</h2>
          <p className="text-sm text-muted-foreground">
            Sketch the room before you book. Sharing a plan with the couple, and choosing the plan for the day, wait until this relationship is Booked.
          </p>
          <FloorPlanWorkspace
            eventId=""
            planningClientId={client.id}
            floorPlans={floorPlans}
            templates={floorPlanTemplates}
            spaces={spaces}
            eventSpaceId={null}
            canEdit={canEditFloorPlans(staffRole)}
            canDelete={canDeleteFloorPlanRows(staffRole)}
          />
        </section>
        <section id="event-order" className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Event order</h2>
          <p className="text-sm text-muted-foreground">
            Prepare what this event would include. Starting an event order does not book the date.
          </p>
          <EventOrderPanel
            eventId=""
            planningClientId={client.id}
            clientId={client.id}
            clientName={displayName}
            clientEmail={client.email}
            venueName={venue?.name}
            eventOrder={eventOrder}
            packages={packageList}
            packagesWithItems={packagesWithItems}
            offerings={offerings}
            inventoryItems={inventoryItems}
            invoices={[]}
            floorPlans={floorPlans}
            templates={eventOrderTemplates}
          />
        </section>
        <section id="vendors" className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Vendors</h2>
          <p className="text-sm text-muted-foreground">
            Note who you expect to work this event. Assigning a vendor now does not reserve the date or tell them the event is booked.
          </p>
          <EventVendorsSection
            eventId=""
            planningClientId={client.id}
            initialAssignments={vendorAssignments}
            availableVendors={vendors}
          />
        </section>
        <p className="text-sm text-muted-foreground">
          Questionnaires stay unavailable until this relationship is Booked. They describe the booked occasion, not the preparation.
        </p>
      </div>
    );
  }

  if (await bookingCelebrationPending(client.linkedEventId)) {
    redirect(`/clients/${client.id}/booked?eventId=${client.linkedEventId}`);
  }

  const eventId = client.linkedEventId;
  // Slice 2 — collapse the Wave A → Wave B serial barrier.
  // Independent reads still fan out together. Dependent reads chain from their
  // parent promise so they start as soon as that parent resolves, overlapping
  // remaining siblings instead of waiting for every Wave A call to finish.
  // Data dependencies (invoice ids → markers, choice-list → choices, tasks →
  // contacts/requests, venue+contracts → Luv observations, conversation id →
  // messages) are preserved — only the artificial full-wave wait is removed.
  // Venue-wide catalogs (packages/offerings/inventory) stay for a later slice;
  // Slice 3A scopes contracts (client|event, no content) + template metadata.
  // Luv observations are record-scoped inside getContextualObservationsForRecord.

  // Slice 3B — scope invoices to this client OR event (same semantics as the
  // former venue-wide load + app-side filter).
  const eventInvoicesPromise = getInvoicesForClientOrEvent(id, eventId);
  const invoiceLineMarkersPromise = eventInvoicesPromise.then((eventInvoices) =>
    getInvoiceLineMarkers(eventInvoices.map((inv) => inv.id)),
  );

  const questionnairesPromise = getQuestionnaires(eventId);
  const activityListsPromise = questionnairesPromise.then((questionnaires) =>
    Promise.all(questionnaires.map(async (q) => [q.id, await getQuestionnaireActivities(q.id)] as const)),
  );

  const eventTasksPromise = getEventTasks(eventId);
  const requestsByIdsPromise = eventTasksPromise.then((eventTasks) => {
    const requestIds = eventTasks.map((t) => t.requestId).filter((v): v is string => !!v);
    return getRequestsByIds(requestIds);
  });
  const taskContactsPromise = eventTasksPromise.then((eventTasks) =>
    getTaskContactsByStaffIds(eventTasks.map((t) => t.assignedToStaffId)),
  );

  const clientChoicesListPromise = listClientChoicesForEvent(eventId);
  const clientChoicesRawPromise = clientChoicesListPromise.then((list) =>
    Promise.all(list.map((c) => getClientChoices(c.id))),
  );

  const venuePromise = getCurrentVenue();
  // teamMembers only needs venue id — start via cached getCurrentVenue, not after
  // the full independent batch (was Wave B only because venue lived in Wave A).
  const teamMembersPromise = venuePromise.then((v) => (v ? getTeamMembers(v.id) : []));

  // Slice 3A — scope contracts to this client OR event; omit full content.
  const contractsPromise = getContractsForClientOrEvent(id, eventId);
  const contextualObservationsPromise = Promise.all([venuePromise, contractsPromise]).then(
    ([venue, contracts]) =>
      venue
        ? getContextualObservationsForRecord(venue.id, venue.timezone, {
            eventId,
            clientId: id,
            contractIds: contracts.map((c) => c.id),
          })
        : Promise.resolve([]),
  );

  // Lead extras own their createClient — no serial createClient ahead of the batch.
  // Contact email/phone/partnerEmail come from cached getClient (duplicate clients
  // select removed).
  const leadExtrasPromise = client.leadId
    ? (async () => {
        const supabase = await createClient();
        const [leadRes, noteRes, tourRes] = await Promise.all([
          supabase
            .from("leads")
            .select("source, inquiry_message, inquiry_message_origin, created_at")
            .eq("id", client.leadId!)
            .maybeSingle<{
              source: string | null;
              inquiry_message: string | null;
              inquiry_message_origin: string | null;
              created_at: string;
            }>(),
          supabase
            .from("lead_notes")
            .select("id, body, created_at, updated_at")
            .eq("lead_id", client.leadId!)
            .order("created_at", { ascending: false }),
          supabase
            .from("tour_appointments")
            .select("id, notes, created_at, completed_at, actual_occurred_at, scheduled_at")
            .eq("lead_id", client.leadId!),
        ]);
        return { leadRow: leadRes.data, noteRows: noteRes.data, tourRows: tourRes.data };
      })()
    : Promise.resolve({ leadRow: null, noteRows: null, tourRows: null });

  const [
    event, availableVendors, eventInvoices, documents, vendorDocuments, workspaceDocuments, pinnedDocumentKeys, questionnaires, eventTasks, allPlaybookTemplates,
    playbookApplications, readinessByKind, contextLinksByTask, timelineEntries, venue, vendorRecommendations,
    spaces, contractTemplates, contracts, allTimelineTemplates,
    timelineSections, timelineLinksByEntry, timelineAttachmentsByEntry, timelineRelatedLinksByEntry,
    floorPlanTemplates, inventoryUsage, eventInventory, inventoryTemplates, inventoryCatalogItems,
    staffRole, questionnaireTemplates, floorPlanOffers, spaceAssignments, sessions,
    guestSummary, seatingSummary,
    eventOrder, packages, eventOrderTemplates, packagesWithItems, selectedPackage, bookingJourney, offerings, paymentSchedules,
    eventRequests, photo, leadExtras, conversationBundle,
    invoiceLineMarkers, activityLists, requestsById, taskContacts, teamMembers, clientChoicesRaw, contextualObservations,
  ] = await Promise.all([
    getEvent(eventId), getVendors(), eventInvoicesPromise, getDocuments("event", eventId), getEventDocumentsFromVendors(eventId),
    getVenueWorkspaceDocuments({ eventId, clientId: id }), getPinnedDocumentKeys().then((s) => [...s]),
    questionnairesPromise,
    eventTasksPromise, getTemplatesForLibrary(), getEventPlaybookApplications(eventId), getEventTaskReadinessByKind(eventId),
    getEventTaskContextLinksForEvent(eventId), getTimelineEntries(eventId), venuePromise, getEventRecommendations(eventId),
    getSpaces(), getContractTemplates(), contractsPromise, getTimelineTemplatesForLibrary(),
    getSections(eventId), getEntryLinksForEvent(eventId), getEntryAttachmentsForEvent(eventId), getRelatedLinksForEvent(eventId),
    getFloorPlanTemplates(), getUsageForEvent(eventId),
    // D5A — Event Inventory is not feature-flagged (unlike Event Order):
    // it's additive to the venue-wide catalog every venue already has.
    getEventInventory(eventId), getInventoryTemplates(), getInventoryItems(),
    getCurrentUserRole(),
    getQuestionnaireTemplates(),
    getEventFloorPlanOffers(eventId),
    getEventSpaceAssignments(eventId),
    getPortalSessions(id),
    getGuestReadinessSummary(id),
    getSeatingReadinessSummary(null, eventId),
    getEventOrder(eventId),
    getPackages(),
    getEventOrderTemplates(),
    getPackagesWithItems(true),
    getActiveSelectedPackageForClient(client.id),
    loadBookingJourneyForClient({
      clientId: client.id,
      eventId,
      leadId: client.leadId,
    }),
    listActiveOfferings(),
    getPaymentSchedules(),
    getRequests({ eventId }),
    client.relationshipId
      ? getRelationshipPhotoForVenue(client.relationshipId)
      : Promise.resolve(null),
    leadExtrasPromise,
    // Conversation: relationship → conversation id → messages (inner serial only).
    (async (): Promise<{ conversationId: string | null; messages: ConversationMessage[] }> => {
      const relationshipId = client.relationshipId;
      if (!relationshipId) return { conversationId: null, messages: [] };
      const conversationId = await getConversationIdForRelationship(relationshipId);
      if (!conversationId) return { conversationId: null, messages: [] };
      const conversation = await getConversation(conversationId);
      return { conversationId, messages: conversation?.messages ?? [] };
    })(),
    invoiceLineMarkersPromise,
    activityListsPromise,
    requestsByIdsPromise,
    taskContactsPromise,
    teamMembersPromise,
    // clientChoicesListPromise is started above; only the dependent raw payload is awaited here.
    clientChoicesRawPromise,
    contextualObservationsPromise,
  ]);
  if (!event) notFound();
  const floorPlanCanEdit = canEditFloorPlans(staffRole);
  const floorPlanCanDelete = canDeleteFloorPlanRows(staffRole);
  // D5D — additive templates + activity logs for each working form.
  const questionnaire = questionnaires.find((q) => q.kind === "final_details") ?? questionnaires[0] ?? null;
  // Archived templates aren't valid choices for applying to a booking —
  // same exclusion the old getTemplates() applied by default.
  const playbookTemplates = allPlaybookTemplates.filter((t) => !t.isArchived);
  const timelineTemplates = allTimelineTemplates.filter((t) => !t.isArchived);

  const bookingCommitmentInvoiceIds = packageBookingCommitmentInvoiceIds(invoiceLineMarkers);
  const frozenLineIds = frozenEventOrderLineIds(
    invoiceLineMarkers,
    eventInvoices.filter((inv) => inv.status !== "void").map((inv) => inv.id),
  );
  const spaceName = spaces.find((s) => s.id === event.spaceId)?.name ?? null;
  const spaceAssignmentsDisplay = formatEventSpaceAssignmentsDisplay(
    spaceAssignments.map((a) => ({
      useKey: a.useKey,
      useLabel: a.useLabel,
      spaceName: a.spaceName ?? spaces.find((s) => s.id === a.spaceId)?.name ?? "—",
    })),
  );

  const questionnaireActivitiesById = Object.fromEntries(activityLists);
  const questionnaireActivities = questionnaire ? (questionnaireActivitiesById[questionnaire.id] ?? []) : [];

  // Request Framework integration: tasks may optionally link to a Request.
  // Independent lifecycle — this only resolves current status/due date for
  // display, it never affects task completion.
  const requestsByTaskId: Record<string, Request> = {};
  for (const task of eventTasks) {
    if (task.requestId && requestsById[task.requestId]) requestsByTaskId[task.id] = requestsById[task.requestId];
  }

  const coupleEmail = client.email ?? null;

  let relationshipContact: {
    clientId: string;
    firstName: string | null;
    lastName: string | null;
    partnerFirstName: string | null;
    partnerLastName: string | null;
    phone: string | null;
    email: string | null;
    partnerEmail: string | null;
    source: string | null;
    inquiryMessage: string | null;
    inquiryMessageOrigin?: string | null;
  } | null = null;
  let leadNotes: { id: string; body: string; createdAt: string; updatedAt?: string }[] = [];
  if (client.leadId) {
    const leadRow = leadExtras.leadRow;
    const sourceLabel = leadRow?.source
      ? (LEAD_SOURCES.find((s) => s.value === leadRow.source)?.label ?? leadRow.source)
      : null;
    relationshipContact = {
      clientId: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      partnerFirstName: client.partnerFirstName,
      partnerLastName: client.partnerLastName,
      phone: client.phone || null,
      email: client.email || null,
      partnerEmail: client.partnerEmail || null,
      source: sourceLabel,
      inquiryMessage: leadRow?.inquiry_message ?? null,
      inquiryMessageOrigin: leadRow?.inquiry_message_origin ?? "unknown",
    };
    leadNotes = ((leadExtras.noteRows ?? []) as { id: string; body: string; created_at: string; updated_at?: string }[]).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }));
  } else {
    relationshipContact = {
      clientId: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      partnerFirstName: client.partnerFirstName,
      partnerLastName: client.partnerLastName,
      phone: client.phone || null,
      email: client.email || null,
      partnerEmail: client.partnerEmail || null,
      source: null,
      inquiryMessage: null,
    };
  }

  const conversationId = conversationBundle.conversationId;
  const conversationMessages = conversationBundle.messages;
  const internalNoteItems = buildInternalNotesRollup({
    inquiry: client.leadId && leadExtras.leadRow
      ? {
          leadId: client.leadId,
          body: leadExtras.leadRow.inquiry_message,
          origin: leadExtras.leadRow.inquiry_message_origin,
          createdAt: leadExtras.leadRow.created_at,
        }
      : null,
    tours: ((leadExtras.tourRows ?? []) as Array<{
      id: string;
      notes: string | null;
      created_at: string;
      completed_at: string | null;
      actual_occurred_at: string | null;
      scheduled_at: string | null;
    }>).map((t) => ({
      id: t.id,
      notes: t.notes,
      createdAt: t.created_at,
      completedAt: t.completed_at,
      actualOccurredAt: t.actual_occurred_at,
      scheduledAt: t.scheduled_at,
    })),
    leadNotes,
    eventNotes: event.notes,
    clientNotes: client.notes,
    clientRecordNotes: {
      clientId: client.id,
      body: client.internalNotes,
      createdAt: client.createdAt,
    },
    conversationNotes: conversationMessages
      .filter((m) => m.channel === "internal_note")
      .map((m) => ({ id: m.id, body: m.body, sentAt: m.sentAt })),
  });
  const linkableConversationMessages: LinkableConversationMessage[] = conversationMessages.map((m) => ({
    id: m.id,
    label: m.channel === "internal_note" ? "Internal Note" : "Conversation",
    detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
  }));

  // Prefer a non-financial session — a 'financial' session's own RPCs
  // (e.g. get_seating_data) deliberately return zeroed-out stats for that
  // access level, and it's also the wrong link to hand a coordinator who
  // just wants "open the couple's portal."
  const portalSession = sessions.find((s) => s.accessLevel !== "financial") ?? sessions[0] ?? null;
  const portalToken = portalSession?.accessToken ?? null;

  const eoLinkedInvoice = eventOrder
    ? eventInvoices.find((inv) => inv.eventOrderId === eventOrder.id && inv.status === "draft")
      ?? eventInvoices.find((inv) => inv.eventOrderId === eventOrder.id && inv.status !== "void")
      ?? null
    : null;
  const eoLinkedScheduleId = eoLinkedInvoice
    ? (paymentSchedules.find((s) => s.invoiceId === eoLinkedInvoice.id)?.id ?? null)
    : null;
  const clientChoices = clientChoicesRaw.filter((c): c is NonNullable<typeof c> => !!c);
  const financialImpact = buildSelectionsFinancialImpact({
    eventOrderId: eventOrder?.id ?? null,
    clientId: event.clientId,
    lines: eventOrder?.lines ?? [],
    invoices: eventInvoices,
    frozenEventOrderLineIds: frozenLineIds,
  });
  // Shared catalog fetch for Event Order Add-from-Inventory and Event Inventory.
  const inventoryItems = inventoryCatalogItems;
  const readinessSummary = buildEventReadiness({
    eventId: event.id,
    readinessByKind, timelineEntries, guestSummary, seatingSummary,
    floorPlans: event.floorPlans, inventoryUsage, requests: eventRequests,
    contracts, invoices: eventInvoices, documents,
    conversationMessages,
    paymentScheduleLines: bookingJourney.paymentLines,
    planningCapabilities: venue
      ? {
          timeline: venue.planningTimelineEnabled,
          floorPlan: venue.planningFloorPlanEnabled,
          seating: venue.planningSeatingEnabled,
          vendors: venue.planningVendorsEnabled,
        }
      : undefined,
  });

  const workspaceName = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);
  const eventSetup = await loadEventSetup(event.id);
  const setupSteps = applicableSetupSteps({
    timeline: venue?.planningTimelineEnabled ?? true,
    floorPlan: venue?.planningFloorPlanEnabled ?? true,
    seating: venue?.planningSeatingEnabled ?? true,
    vendors: venue?.planningVendorsEnabled ?? true,
  });
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DeleteClientRecordButton clientId={client.id} fallbackName={workspaceName} />
      </div>
    <EventDetail
      event={event} availableVendors={availableVendors} invoices={eventInvoices} documents={documents}
      vendorDocuments={vendorDocuments}
      workspaceDocuments={workspaceDocuments}
      pinnedDocumentKeys={pinnedDocumentKeys}
      originatingLeadId={client.leadId}
      relationshipContact={relationshipContact}
      leadNotes={leadNotes}
      internalNoteItems={internalNoteItems}
      questionnaire={questionnaire} questionnaires={questionnaires} questionnaireTemplates={questionnaireTemplates} questionnaireActivities={questionnaireActivities} questionnaireActivitiesById={questionnaireActivitiesById}
      coupleEmail={coupleEmail} eventTasks={eventTasks}
      playbookTemplates={playbookTemplates} playbookApplications={playbookApplications}
      timelineTemplates={timelineTemplates}
      timelineSections={timelineSections} timelineLinksByEntry={timelineLinksByEntry} timelineAttachmentsByEntry={timelineAttachmentsByEntry}
      timelineRelatedLinksByEntry={timelineRelatedLinksByEntry}
      readinessByKind={readinessByKind} contextLinksByTask={contextLinksByTask}
      taskContacts={taskContacts} linkableDocuments={documents} linkableTimelineEntries={timelineEntries}
      linkableConversationMessages={linkableConversationMessages} vendorRecommendations={vendorRecommendations}
      portalToken={portalToken}
      conversationId={conversationId}
      conversationMessages={conversationMessages} spaceName={spaceName}
      spaceAssignmentsDisplay={spaceAssignmentsDisplay}
      venueName={venue?.name ?? "Your venue"} clientStatus={client.status}
      contractTemplates={contractTemplates} contracts={contracts}
      floorPlanTemplates={floorPlanTemplates} spaces={spaces}
      floorPlanOffers={floorPlanOffers}
      floorPlanCanEdit={floorPlanCanEdit}
      floorPlanCanDelete={floorPlanCanDelete}
      inventoryUsage={inventoryUsage}
      teamMembers={teamMembers}
      requestsByTaskId={requestsByTaskId}
      requests={eventRequests}
      readinessSummary={readinessSummary}
      eventOrder={eventOrder}
      packages={packages}
      offerings={offerings}
      inventoryItems={inventoryItems}
      eventInventory={eventInventory}
      inventoryTemplates={inventoryTemplates}
      eventOrderTemplates={eventOrderTemplates}
      clientChoices={clientChoices}
      financialImpact={financialImpact}
      bookingCommitmentInvoiceIds={bookingCommitmentInvoiceIds}
      linkedScheduleId={eoLinkedScheduleId}
      packagesWithItems={packagesWithItems}
      bookingJourney={bookingJourney}
      selectedPackage={selectedPackage}
      openSetupPayments={sp.setupPayments === "1"}
      photoUrl={photo?.displayedPhotoUrl ?? null}
      venueTimezone={venue?.timezone ?? null}
      contextualObservations={contextualObservations}
      eventSetup={eventSetup}
      applicableSetupSteps={setupSteps}
    />
    </div>
  );
}
