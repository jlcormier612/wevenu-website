import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventDetail } from "@/components/events/event-detail";
import type { LinkableConversationMessage } from "@/components/playbooks/event-task-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/availability/service";
import { clientDisplayName } from "@/lib/clients/constants";
import { getClient } from "@/lib/clients/service";
import { getConversation, getConversationIdForRelationship } from "@/lib/conversations/service";
import type { ConversationMessage } from "@/lib/conversations/types";
import { getContracts, getTemplates as getContractTemplates } from "@/lib/contracts/service";
import { getDocuments } from "@/lib/documents/service";
import { getEvent } from "@/lib/events/service";
import { getQuestionnaire } from "@/lib/events/questionnaire";
import { getTemplates as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getUsageForEvent } from "@/lib/inventory/service";
import { getInvoices } from "@/lib/invoices/service";
import { getThreadsForEntity } from "@/lib/messaging/service";
import {
  getEventPlaybookApplications, getEventTaskContextLinksForEvent, getEventTaskReadinessByKind,
  getEventTasks, getTaskContactsByStaffIds, getTemplates,
} from "@/lib/playbooks/service";
import { getPortalSessions } from "@/lib/portal/service";
import { getRequests, getRequestsByIds } from "@/lib/requests/service";
import type { Request } from "@/lib/requests/types";
import { getTeamMembers } from "@/lib/team/service";
import {
  getEntryAttachmentsForEvent, getEntryLinksForEvent, getRelatedLinksForEvent, getSections, getTimelineEntries,
} from "@/lib/timeline/service";
import { getTemplates as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import { getEventRecommendations } from "@/lib/vendor-recommendations/service";
import { getVendors } from "@/lib/vendors/service";

type Props = { params: Promise<{ id: string }> };

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
export default async function BookingWorkspacePage({ params }: Props) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  if (!client.linkedEventId) {
    // Rare: a booked client with no event yet (no event date set at
    // booking time). Reuses the exact "create event" affordance the old
    // Client page offered, rather than a new workflow.
    const displayName = clientDisplayName(client.firstName, client.lastName, client.partnerFirstName, client.partnerLastName);
    return (
      <div className="space-y-6">
        <PageHeader title={displayName} description="This booking doesn't have an event workspace yet." />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <p className="font-heading text-lg font-medium text-heading">No event yet</p>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">Add an event date to open the full workspace.</p>
          <Button render={<Link href={`/events/new?clientId=${client.id}`} />}>+ Create Event</Button>
        </div>
      </div>
    );
  }

  const eventId = client.linkedEventId;
  const [
    event, availableVendors, allInvoices, documents, questionnaire, eventTasks, playbookTemplates,
    playbookApplications, readinessByKind, contextLinksByTask, timelineEntries, venue, vendorRecommendations,
    threads, spaces, contractTemplates, allContracts, timelineTemplates,
    timelineSections, timelineLinksByEntry, timelineAttachmentsByEntry, timelineRelatedLinksByEntry,
    floorPlanTemplates, inventoryUsage,
  ] = await Promise.all([
    getEvent(eventId), getVendors(), getInvoices({}), getDocuments("event", eventId), getQuestionnaire(eventId),
    getEventTasks(eventId), getTemplates(), getEventPlaybookApplications(eventId), getEventTaskReadinessByKind(eventId),
    getEventTaskContextLinksForEvent(eventId), getTimelineEntries(eventId), getCurrentVenue(), getEventRecommendations(eventId),
    getThreadsForEntity("client", id), getSpaces(), getContractTemplates(), getContracts(), getTimelineTemplates(),
    getSections(eventId), getEntryLinksForEvent(eventId), getEntryAttachmentsForEvent(eventId), getRelatedLinksForEvent(eventId),
    getFloorPlanTemplates(), getUsageForEvent(eventId),
  ]);
  if (!event) notFound();
  const eventInvoices = allInvoices.filter((inv) => inv.eventId === eventId || inv.clientId === id);
  const spaceName = spaces.find((s) => s.id === event.spaceId)?.name ?? null;
  const contracts = allContracts.filter((c) => c.eventId === eventId || c.clientId === id);

  // Request Framework integration: tasks may optionally link to a Request.
  // Independent lifecycle — this only resolves current status/due date for
  // display, it never affects task completion.
  const requestIds = eventTasks.map((t) => t.requestId).filter((v): v is string => !!v);
  const [requestsById, eventRequests] = await Promise.all([getRequestsByIds(requestIds), getRequests({ eventId })]);
  const requestsByTaskId: Record<string, Request> = {};
  for (const task of eventTasks) {
    if (task.requestId && requestsById[task.requestId]) requestsByTaskId[task.id] = requestsById[task.requestId];
  }

  const taskContacts = await getTaskContactsByStaffIds(eventTasks.map((t) => t.assignedToStaffId));
  const teamMembers = venue ? await getTeamMembers(venue.id) : [];

  // Same pattern as the old /events/[id]/page.tsx: resolve email + relationship
  // id directly (event.clientId doesn't carry these), for Messages and the
  // anniversary/final-details send-to-couple flows.
  const supabase = await createClient();
  const { data: cl } = await supabase.from("clients").select("email, relationship_id").eq("id", id)
    .maybeSingle<{ email: string | null; relationship_id: string | null }>();
  const coupleEmail = cl?.email ?? null;

  let linkableConversationMessages: LinkableConversationMessage[] = [];
  let conversationMessages: ConversationMessage[] = [];
  const conversationExperienceEnabled = venue?.conversationExperienceEnabled ?? false;
  let conversationId: string | null = null;
  if (conversationExperienceEnabled && cl?.relationship_id) {
    conversationId = await getConversationIdForRelationship(cl.relationship_id);
    if (conversationId) {
      const conversation = await getConversation(conversationId);
      conversationMessages = conversation?.messages ?? [];
      linkableConversationMessages = conversationMessages.map((m) => ({
        id: m.id,
        label: m.channel === "internal_note" ? "Internal Note" : "Conversation",
        detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
      }));
    }
  }
  const sessions = await getPortalSessions(id);
  const portalToken = sessions[0]?.accessToken ?? null;

  return (
    <EventDetail
      event={event} availableVendors={availableVendors} invoices={eventInvoices} documents={documents}
      questionnaire={questionnaire} coupleEmail={coupleEmail} eventTasks={eventTasks}
      playbookTemplates={playbookTemplates} playbookApplications={playbookApplications}
      timelineTemplates={timelineTemplates}
      timelineSections={timelineSections} timelineLinksByEntry={timelineLinksByEntry} timelineAttachmentsByEntry={timelineAttachmentsByEntry}
      timelineRelatedLinksByEntry={timelineRelatedLinksByEntry}
      readinessByKind={readinessByKind} contextLinksByTask={contextLinksByTask}
      taskContacts={taskContacts} linkableDocuments={documents} linkableTimelineEntries={timelineEntries}
      linkableConversationMessages={linkableConversationMessages} vendorRecommendations={vendorRecommendations}
      portalToken={portalToken}
      threads={threads} conversationExperienceEnabled={conversationExperienceEnabled} conversationId={conversationId}
      conversationMessages={conversationMessages} spaceName={spaceName} clientStatus={client.status}
      contractTemplates={contractTemplates} contracts={contracts}
      floorPlanTemplates={floorPlanTemplates} spaces={spaces}
      inventoryUsage={inventoryUsage}
      teamMembers={teamMembers}
      requestsByTaskId={requestsByTaskId}
      requests={eventRequests}
    />
  );
}
