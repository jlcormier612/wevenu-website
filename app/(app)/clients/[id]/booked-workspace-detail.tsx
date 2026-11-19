/**
 * NAV-PERF Wave 7A — deferred booked workspace detail (single Suspense island).
 *
 * Loads the existing EventDetail data graph after Booking identity/status have
 * already been authorized and rendered in the page fallback. ensure* calls stay
 * in this same loader batch with unchanged semantics (timed only).
 */
import { EventDetail } from "@/components/events/event-detail";
import { BookingIdentityFallback } from "@/components/clients/booking-identity-fallback";
import { ClientEventSwitcher } from "@/components/clients/client-event-switcher";
import { PracticeContextBanner } from "@/components/setup-hub/practice-context-banner";
import { findPracticeRunForSample } from "@/lib/practice-run/service";
import { buildInternalNotesRollup } from "@/lib/notes/internal-notes-rollup";
import type { LinkableConversationMessage } from "@/components/playbooks/event-task-list";
import { getConversation, getConversationIdForRelationship } from "@/lib/conversations/service";
import type { ConversationMessage } from "@/lib/conversations/types";
import {
  getContractsForClientOrEvent,
  getTemplatesMetadata as getContractTemplates,
} from "@/lib/contracts/service";
import { getDocuments, getEventDocumentsFromVendors } from "@/lib/documents/service";
import { getPinnedDocumentKeys, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import type { EventWithDetails } from "@/lib/events/types";
import { listEventsForClient } from "@/lib/events/service";
import { getEventSpaceAssignments } from "@/lib/events/space-assignments";
import { formatEventSpaceAssignmentsDisplay } from "@/lib/venue-spaces/uses";
import { getQuestionnaires, getQuestionnaireActivities } from "@/lib/events/questionnaire";
import { ensureQuestionnaireFamilyForCurrentVenue } from "@/lib/questionnaire-family/provision";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getEventFloorPlanOffers } from "@/lib/floor-plan-offers/service";
import { getGuestReadinessSummary } from "@/lib/guests/service";
import { getFloorPlanSeatCountsForEvent } from "@/lib/floor-plans/service";
import { getUsageForEvent } from "@/lib/inventory/service";
import { getInvoiceLineMarkers, getInvoicesForClientOrEvent } from "@/lib/invoices/service";
import {
  frozenEventOrderLineIds,
  packageBookingCommitmentInvoiceIds,
} from "@/lib/invoices/booking-commitment";
import { buildSelectionsFinancialImpact } from "@/lib/client-choices/selections-billing";
import { getPaymentSchedules } from "@/lib/payments/service";
import {
  getEventPlaybookApplications, getEventTaskContextLinksForEvent, getEventTaskReadinessByKind,
  getEventTasks, getTaskContactsByStaffIds, getTemplatesForLibrary,
} from "@/lib/playbooks/service";
import { getPortalSessions } from "@/lib/portal/service";
import { buildEventReadiness } from "@/lib/readiness/compute";
import { getRequests, getRequestsByIds } from "@/lib/requests/service";
import type { Request } from "@/lib/requests/types";
import { getSeatingReadinessSummary } from "@/lib/seating/service";
import { getTeamMembers } from "@/lib/team/service";
import {
  getEntryAttachmentsForEvent, getEntryLinksForEvent, getImportedClientTimelineEntries, getRelatedLinksForEvent, getSections, getTimelineEntries,
} from "@/lib/timeline/service";
import { getTemplatesForLibrary as getTimelineTemplatesForLibrary } from "@/lib/timeline-templates/service";
import { LEAD_SOURCES } from "@/lib/leads/constants";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import { isLuvMasterEnabledForVenueId } from "@/lib/luv/settings";
import {
  canDeleteFloorPlanRows,
  canEditFloorPlans,
} from "@/lib/floor-plans/authorize";
import { getOrEnsureEventRecommendations } from "@/lib/vendor-recommendations/service";
import { getVendors } from "@/lib/vendors/service";
import { getEventOrder } from "@/lib/event-orders/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import {
  getClientChoices,
  listClientChoicesForEvent,
} from "@/lib/client-choices/service";
import { listActiveOfferings } from "@/lib/offerings/service";
import { getPackages, getPackagesWithItems } from "@/lib/packages/service";
import { loadBookingJourneyForClient } from "@/lib/booking-journey/load";
import { getActiveSelectedPackageForClient } from "@/lib/commercial-selections/service";
import { getItems as getInventoryItems } from "@/lib/inventory/service";
import { getEventInventory, getTemplates as getInventoryTemplates } from "@/lib/event-inventory/service";
import { getRelationshipPhotoForVenue } from "@/lib/relationship-photos/service";
import { getContextualObservationsForRecord } from "@/lib/luv/contextual-record";
import { getDraftsForLead } from "@/lib/luv/drafts";
import { loadLeadFollowUpPresentation } from "@/lib/luv/follow-up-presentation";
import { getLead } from "@/lib/leads/service";
import { loadEventSetup } from "@/lib/event-setup/service";
import { applicableSetupSteps } from "@/lib/event-setup/state";
import { capabilitiesFromVenue } from "@/lib/playbooks/capabilities";
import { getSpaces } from "@/lib/availability/service";
import { clientDisplayName } from "@/lib/clients/constants";
import type { ClientWithDetails } from "@/lib/clients/types";
import {
  bookingFbDeferredBoundary,
  bookingFbDeferredTime,
} from "@/lib/shell/booking-first-byte-timing";

type Props = {
  client: ClientWithDetails;
  event: EventWithDetails;
  eventId: string;
  clientEvents: Awaited<ReturnType<typeof listEventsForClient>>;
  setupPayments?: string;
};

export async function BookedWorkspaceDetail(props: Props) {
  try {
    return await renderBookedWorkspaceDetail(props);
  } catch (error) {
    console.error("[booking-workspace-detail] deferred load failed", error);
    return (
      <BookingIdentityFallback
        client={props.client}
        event={props.event}
        eventId={props.eventId}
        clientEvents={props.clientEvents}
        deferredMessage="Couldn’t load the planning workspace. Refresh to try again."
        deferredTestId="booking-workspace-detail-error"
      />
    );
  }
}

async function renderBookedWorkspaceDetail({
  client,
  event,
  eventId,
  clientEvents,
  setupPayments,
}: Props) {
  const id = client.id;
  const sp = { setupPayments };

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
  const luvEnabledPromise = venuePromise.then((v) =>
    v ? isLuvMasterEnabledForVenueId(v.id) : Promise.resolve(false),
  );

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

  // Booked Luv tab reuses the originating lead's drafting lifecycle (same engine as Lead Luv).
  const luvLeadBundlePromise = client.leadId
    ? (async () => {
        const lead = await getLead(client.leadId!);
        if (!lead) {
          return {
            luvLead: null,
            luvDrafts: [],
            followUpDraftCapable: false,
            followUpDraftIneligibleReason: "This booking has no linked lead for Luv drafting.",
            followUpProactiveRecommended: false,
          };
        }
        const [luvDrafts, followUpPresentation] = await Promise.all([
          getDraftsForLead(lead.id),
          loadLeadFollowUpPresentation(lead),
        ]);
        return {
          luvLead: lead,
          luvDrafts,
          followUpDraftCapable: followUpPresentation.draftCapable,
          followUpDraftIneligibleReason: followUpPresentation.draftIneligibleReason,
          followUpProactiveRecommended: followUpPresentation.proactiveRecommended,
        };
      })()
    : Promise.resolve({
        luvLead: null,
        luvDrafts: [] as Awaited<ReturnType<typeof getDraftsForLead>>,
        followUpDraftCapable: false,
        followUpDraftIneligibleReason: "This booking has no linked lead for Luv drafting.",
        followUpProactiveRecommended: false,
      });

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

  const deferredStarted = performance.now();
  // `event` comes from the authenticated page shell (already venue-scoped). Reuse it
  // here so we do not re-fetch or shadow the prop during destructuring.
  const [
    availableVendors, eventInvoices, documents, vendorDocuments, workspaceDocuments, pinnedDocumentKeys, questionnaires, eventTasks, allPlaybookTemplates,
    playbookApplications, readinessByKind, contextLinksByTask, timelineEntries, venue, vendorRecommendations,
    spaces, contractTemplates, contracts, allTimelineTemplates,
    timelineSections, timelineLinksByEntry, timelineAttachmentsByEntry, timelineRelatedLinksByEntry,
    floorPlanTemplates, inventoryUsage, floorPlanSeatCounts, eventInventory, inventoryTemplates, inventoryCatalogItems,
    staffRole, questionnaireTemplates, floorPlanOffers, spaceAssignments, sessions,
    guestSummary, seatingSummary,
    eventOrder, packages, eventOrderTemplates, packagesWithItems, selectedPackage, bookingJourney, offerings, paymentSchedules,
    eventRequests, photo, leadExtras, conversationBundle,
    invoiceLineMarkers, activityLists, requestsById, taskContacts, teamMembers, clientChoicesRaw, contextualObservations,
    luvLeadBundle, luvEnabled,
  ] = await Promise.all([
    getVendors(), eventInvoicesPromise, getDocuments("event", eventId), getEventDocumentsFromVendors(eventId),
    getVenueWorkspaceDocuments({ eventId, clientId: id }), getPinnedDocumentKeys().then((s) => [...s]),
    questionnairesPromise,
    eventTasksPromise, getTemplatesForLibrary(), getEventPlaybookApplications(eventId), getEventTaskReadinessByKind(eventId),
    getEventTaskContextLinksForEvent(eventId), getTimelineEntries(eventId), venuePromise, bookingFbDeferredTime("get_or_ensure_event_recommendations", () => getOrEnsureEventRecommendations(eventId)),
    getSpaces(), getContractTemplates(), contractsPromise, getTimelineTemplatesForLibrary(),
    getSections(eventId), getEntryLinksForEvent(eventId), getEntryAttachmentsForEvent(eventId), getRelatedLinksForEvent(eventId),
    getFloorPlanTemplates(), getUsageForEvent(eventId), getFloorPlanSeatCountsForEvent(eventId),
    // D5A — Event Inventory is not feature-flagged (unlike Event Order):
    // it's additive to the venue-wide catalog every venue already has.
    getEventInventory(eventId), getInventoryTemplates(), getInventoryItems(),
    getCurrentUserRole(),
    // Ensure Library starters exist before category selectors render — do not
    // depend on visiting Library or sending another questionnaire first.
    bookingFbDeferredTime("ensure_questionnaire_family_plus_templates", () => ensureQuestionnaireFamilyForCurrentVenue().then(() => getQuestionnaireTemplates())),
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
    luvLeadBundlePromise,
    luvEnabledPromise,
  ]);
  bookingFbDeferredBoundary("booked_detail_promise_all", performance.now() - deferredStarted);
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
  const scheduleComponents = spaceAssignments.map((a) => ({
    useKey: a.useKey,
    useLabel: a.useLabel,
    spaceName: a.spaceName ?? spaces.find((s) => s.id === a.spaceId)?.name ?? null,
    scheduledDate: a.scheduledDate ?? null,
    startTime: a.startTime ?? null,
    endTime: a.endTime ?? null,
    sortOrder: a.sortOrder,
  }));
  const editableSpaceAssignments = spaceAssignments.map((a) => ({
    useKey: a.useKey,
    useLabel: a.useLabel,
    spaceId: a.spaceId,
    startTime: a.startTime ?? null,
    endTime: a.endTime ?? null,
    scheduledDate: a.scheduledDate ?? null,
  }));

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
  const portalSession = sessions.find((s) => s.accessLevel !== "financial") ?? null;
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
    planningCapabilities: venue ? capabilitiesFromVenue(venue) : undefined,
  });

  const workspaceName = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);
  const eventSetup = await bookingFbDeferredTime("load_event_setup", () => loadEventSetup(event.id));
  const setupSteps = applicableSetupSteps(capabilitiesFromVenue(venue));
  const practiceRun = await findPracticeRunForSample({
    clientId: client.id,
    leadId: client.leadId,
    eventId: event.id,
  });
  return (
    <div className="space-y-3" data-testid="booking-workspace-detail-ready">
      {practiceRun ? <PracticeContextBanner run={practiceRun} /> : null}
      <ClientEventSwitcher
        clientId={client.id}
        events={clientEvents}
        currentEventId={eventId}
      />
    <EventDetail
      event={event} importedClientTimeline={await getImportedClientTimelineEntries(eventId)} availableVendors={availableVendors} invoices={eventInvoices} documents={documents}
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
      scheduleComponents={scheduleComponents}
      editableSpaceAssignments={editableSpaceAssignments}
      venueName={venue?.name ?? "Your venue"} clientStatus={client.status}
      contractTemplates={contractTemplates} contracts={contracts}
      floorPlanTemplates={floorPlanTemplates} spaces={spaces}
      floorPlanOffers={floorPlanOffers}
      floorPlanCanEdit={floorPlanCanEdit}
      floorPlanCanDelete={floorPlanCanDelete}
      inventoryUsage={inventoryUsage}
      floorPlanSeatCounts={floorPlanSeatCounts}
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
      openSetupPayments={setupPayments === "1"}
      photoUrl={photo?.displayedPhotoUrl ?? null}
      venueTimezone={venue?.timezone ?? null}
      contextualObservations={contextualObservations}
      luvLead={luvLeadBundle.luvLead}
      luvDrafts={luvLeadBundle.luvDrafts}
      followUpDraftCapable={luvLeadBundle.followUpDraftCapable}
      followUpDraftIneligibleReason={luvLeadBundle.followUpDraftIneligibleReason}
      followUpProactiveRecommended={luvLeadBundle.followUpProactiveRecommended}
      luvEnabled={luvEnabled}
      eventSetup={eventSetup}
      applicableSetupSteps={setupSteps}
    />
    </div>
  );
}
