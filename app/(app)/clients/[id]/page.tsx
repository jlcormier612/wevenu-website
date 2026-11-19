import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { BookedWorkspaceDetail } from "@/app/(app)/clients/[id]/booked-workspace-detail";
import { BookingIdentityFallback } from "@/components/clients/booking-identity-fallback";
import { DeleteClientRecordButton } from "@/components/clients/delete-client-record-button";
import { PreparingMessagesDeepLink } from "@/components/clients/preparing-messages-deep-link";
import { PracticeContextBanner } from "@/components/setup-hub/practice-context-banner";
import { BookingJourneyPanel } from "@/components/booking-journey/booking-journey-panel";
import { findPracticeRunForSample } from "@/lib/practice-run/service";
import { EventTaskList } from "@/components/playbooks/event-task-list";
import { TimelineView } from "@/components/events/timeline/timeline-view";
import { FloorPlanWorkspace } from "@/components/events/floor-plan-workspace";
import { EventOrderPanel } from "@/components/event-orders/event-order-panel";
import { EventVendorsSection } from "@/components/events/vendors/event-vendors-section";
import { VenueVendorDirectorySummary } from "@/components/events/vendors/venue-vendor-directory-summary";
import { getClientTasks } from "@/lib/playbooks/service";
import { getClientTimelineEntries, getClientSections } from "@/lib/timeline/service";
import { getFloorPlansForClient } from "@/lib/floor-plans/service";
import { getEventOrderForClient } from "@/lib/event-orders/service";
import { getClientVendorAssignments } from "@/lib/vendors/service";
import { DocumentWorkspace } from "@/components/document-workspace/document-workspace";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getHolds, getSpaces } from "@/lib/availability/service";
import { workspaceDateText } from "@/lib/availability/workspace-date-language";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { getPinnedDocumentKeys, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import { getEvent, listEventsForClient } from "@/lib/events/service";
import { resolveClientWorkspaceEventId } from "@/lib/events/workspace-event";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import {
  getClientPlaybookApplications, getTemplatesForLibrary,
} from "@/lib/playbooks/service";
import { getTemplatesForLibrary as getTimelineTemplatesForLibrary } from "@/lib/timeline-templates/service";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";
import {
  canDeleteFloorPlanRows,
  canEditFloorPlans,
} from "@/lib/floor-plans/authorize";
import { getVendors } from "@/lib/vendors/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { listActiveOfferings } from "@/lib/offerings/service";
import { getPackages, getPackagesWithItems } from "@/lib/packages/service";
import { bookingCelebrationPending } from "@/lib/booking-journey/booking-celebration";
import { loadBookingJourneyForClient } from "@/lib/booking-journey/load";
import { getItems as getInventoryItems } from "@/lib/inventory/service";
import { getRelationshipPhotoForVenue } from "@/lib/relationship-photos/service";
import { RelationshipPhotoAvatar } from "@/components/relationship-photos/relationship-photo-avatar";
import {
  bookingFbExtra,
  bookingFbSetVenue,
  bookingFbTime,
  withBookingFirstByteTiming,
} from "@/lib/shell/booking-first-byte-timing";

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
  return withBookingFirstByteTiming(async () => {
  const { id } = await params;
  const sp = await searchParams;
  const client = await bookingFbTime("get_client", () => getClient(id));
  if (!client) notFound();
  bookingFbSetVenue(client.venueId);

  if (!client.linkedEventId) {
    const displayName = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);
    // Slice 2 — photo is independent of the rest of the unbooked workspace reads.
    const [
      photo, journey, packagesWithItems, packageList, templates, applications, tasks,
      timelineEntries, timelineSections, timelineTemplates, venue, spaces,
      floorPlans, floorPlanTemplates, vendors, vendorAssignments, eventOrder, eventOrderTemplates,
      offerings, inventoryItems, staffRole, dateHolds,
      workspaceDocuments, pinnedDocumentKeys, practiceRun,
    ] = await bookingFbTime("unbooked_workspace_batch", () => Promise.all([
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
      client.leadId ? getHolds({ leadId: client.leadId }) : Promise.resolve([]),
      getVenueWorkspaceDocuments({ clientId: client.id }),
      getPinnedDocumentKeys(),
      findPracticeRunForSample({ clientId: client.id, leadId: client.leadId }),
    ]));
    bookingFbExtra("path", "unbooked");
    const activeTimelineTemplates = timelineTemplates.filter((t) => !t.isArchived);
    const activePlaybookTemplates = templates.filter((t) => !t.isArchived);
    return (
      <div className="space-y-8">
        {practiceRun ? <PracticeContextBanner run={practiceRun} /> : null}
        <PreparingMessagesDeepLink leadId={client.leadId} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <RelationshipPhotoAvatar
              photoUrl={photo?.displayedPhotoUrl ?? null}
              name={displayName}
              size="lg"
              editHref={`/clients/${client.id}/edit`}
            />
            <PageHeader
              title={displayName}
              description="You are preparing this client's planning workspace. Preparing the workspace does not reserve their date."
            />
          </div>
          <DeleteClientRecordButton clientId={client.id} fallbackName={displayName} />
        </div>
        <p className="text-sm text-muted-foreground" data-testid="client-date-state">
          {workspaceDateText({
            eventDate: client.eventDate,
            booked: false,
            holds: dateHolds,
            leadId: client.leadId,
          })}
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
        <section id="documents" className="space-y-3">
          <DocumentWorkspace
            title="Documents"
            description="Files for this client while you prepare the workspace. Booking does not move them onto a different event."
            documents={workspaceDocuments}
            initialPinnedKeys={[...pinnedDocumentKeys]}
            uploadTarget={{ entityType: "client", entityId: client.id, venueId: client.venueId }}
            returnTo={`/clients/${client.id}`}
          />
        </section>
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
            guestCount={client.guestCount}
          />
        </section>
        <section id="vendors" className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Vendors</h2>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-heading">Vendor directory</h3>
            <VenueVendorDirectorySummary vendors={vendors} />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-heading">Assigned to this event</h3>
            <p className="text-sm text-muted-foreground">
              Who you expect to work this event. Separate from the directory above. Assigning a vendor now does not reserve the date or tell them the event is booked.
            </p>
          <EventVendorsSection
            eventId=""
            planningClientId={client.id}
            initialAssignments={vendorAssignments}
            availableVendors={vendors}
          />
          </div>
        </section>
        <p className="text-sm text-muted-foreground">
          Questionnaires stay unavailable until this relationship is Booked. They describe the booked occasion, not the preparation.
        </p>
      </div>
    );
  }

  const clientEvents = await bookingFbTime("list_events_for_client", () => listEventsForClient(id));
  const eventId = resolveClientWorkspaceEventId(clientEvents, sp.eventId, client.linkedEventId);
  if (!eventId) notFound();

  if (await bookingFbTime("booking_celebration_pending", () => bookingCelebrationPending(eventId))) {
    redirect(`/clients/${client.id}/booked?eventId=${eventId}`);
  }

  const event = await bookingFbTime("get_event_identity", () => getEvent(eventId));
  if (!event) notFound();
  bookingFbExtra("path", "booked");
  bookingFbExtra("deferred_boundary", "booked_workspace_detail");

  const workspaceName = clientDisplayName(
    client.firstName,
    client.lastName,
    client.partnerFirstName,
    client.partnerLastName,
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <DeleteClientRecordButton clientId={client.id} fallbackName={workspaceName} />
      </div>
      <Suspense
        fallback={
          <BookingIdentityFallback
            client={client}
            event={event}
            eventId={eventId}
            clientEvents={clientEvents}
          />
        }
      >
        <BookedWorkspaceDetail
          client={client}
          event={event}
          eventId={eventId}
          clientEvents={clientEvents}
          setupPayments={sp.setupPayments}
        />
      </Suspense>
    </div>
  );
  });
}
