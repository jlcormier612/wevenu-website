import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LeadDetail } from "@/components/leads/lead-detail";
import { withTimeout } from "@/lib/async/with-timeout";
import { getHolds, getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";
import { loadBookingJourneyForLead } from "@/lib/booking-journey/load";
import { getDocuments } from "@/lib/documents/service";
import { getPinnedDocumentKeys, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import { getDraftsForLead } from "@/lib/luv/drafts";
import { getContextualObservationsForRecord } from "@/lib/luv/contextual-record";
import {
  isFollowUpSilenceBlock,
  observationsForDraftSurface,
} from "@/lib/luv/draft-recommendation-surface";
import { loadLeadFollowUpPresentation } from "@/lib/luv/follow-up-presentation";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead } from "@/lib/leads/service";
import { getActiveTemplate } from "@/lib/pipeline-templates/service";
import { getPackagesWithItems } from "@/lib/packages/service";
import { getCurrentStaffMember, getTeamMembers } from "@/lib/team/service";
import { getTourAppointmentsForLead } from "@/lib/tours/service";
import { getConversationIdForRelationship } from "@/lib/conversations/service";
import { leadMessageAttentionHref, type LeadMessageAttention } from "@/lib/leads/message-attention";
import { loadConversationInternalNotes } from "@/lib/notes/load-conversation-internal-notes";
import { createClient } from "@/integrations/supabase/server";
import { getSmsPermissionEvidenceForContact } from "@/lib/communication/contact-permission-view";
import { getDuplicateReviewForLead } from "@/lib/leads/duplicate-review";
import { markLeadVenueSeen } from "@/lib/navigation/attention-service";
import { getRelationshipPhotoForVenue } from "@/lib/relationship-photos/service";
import { isSmsConfigured } from "@/lib/sms/send";
import { getCurrentVenue } from "@/lib/venue/service";
import { getLeadSpacePreferences } from "@/lib/leads/space-preferences-service";
import { getEventSpaceAssignments } from "@/lib/events/space-assignments";

/** Fail the route instead of hanging the Lead detail RSC payload forever. */
const LEAD_DETAIL_LOAD_TIMEOUT_MS = 45_000;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ luv?: string; setupPayments?: string; tab?: string }>;
};

/** Canonical draft types Luv can auto-open from ?luv=… recommendation links. */
const LUV_DRAFT_PARAMS = new Set(["follow_up_email", "follow_up_text", "next_steps", "timeline"]);

function normalizeAutoLuvDraft(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw === "followup") return "follow_up_email";
  return LUV_DRAFT_PARAMS.has(raw) ? raw : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) return { title: "Lead not found" };
  return {
    title: leadDisplayName(
      lead.firstName,
      lead.lastName,
      lead.partnerFirstName,
      lead.partnerLastName,
    ),
  };
}

export default async function LeadDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { luv: luvParam, setupPayments, tab: tabParam } = await searchParams;
  const autoLuvDraft = normalizeAutoLuvDraft(luvParam);
  // Wave C1: documents + Luv drafts deferred unless deep-linked.
  const eagerDocuments = tabParam === "documents";
  const eagerLuvDrafts = Boolean(autoLuvDraft) || tabParam === "luv";

  const page = await withTimeout(
    (async () => {
      // Share one getSpaces() promise — preferences previously called getSpaces
      // again inside getLeadSpacePreferences, doubling the spaces round trip.
      const spacesPromise = getSpaces();
      const [lead, holds, spaces, capacityRules, tourAppointments, packages, activeTemplate, venue, spacePreferences] =
        await Promise.all([
          getLead(id),
          getHolds({ leadId: id }),
          spacesPromise,
          getCapacityRules(),
          getTourAppointmentsForLead(id),
          getPackagesWithItems(true),
          getActiveTemplate(),
          getCurrentVenue(),
          spacesPromise.then((loadedSpaces) => getLeadSpacePreferences(id, loadedSpaces)),
        ]);
      if (!lead) return null;
      if (lead.mergedIntoLeadId) {
        redirect(`/leads/${lead.mergedIntoLeadId}?mergedFrom=${id}`);
      }

      // After identity is known: run independent domains in one wave
      // (previously sequential conversation → notes → journey → Luv → photo).
      const conversationIdPromise = lead.relationshipId
        ? getConversationIdForRelationship(lead.relationshipId)
        : Promise.resolve(null);

      const [
        documents,
        workspaceDocuments,
        pinnedKeys,
        luvDrafts,
        spaceAssignments,
        conversationId,
        smsPermission,
        duplicateReview,
        teamMembers,
        currentStaff,
        textingConfigured,
        bookingJourney,
        rawObservations,
        followUpPresentation,
        photo,
        archiveState,
      ] = await Promise.all([
        eagerDocuments ? getDocuments("lead", id) : Promise.resolve([]),
        eagerDocuments ? getVenueWorkspaceDocuments({ leadId: id }) : Promise.resolve([]),
        eagerDocuments ? getPinnedDocumentKeys() : Promise.resolve(new Set<string>()),
        eagerLuvDrafts ? getDraftsForLead(id) : Promise.resolve([]),
        lead.linkedEventId
          ? getEventSpaceAssignments(lead.linkedEventId).then((rows) =>
              rows
                .map((a) => ({
                  useKey: a.useKey,
                  useLabel: a.useLabel,
                  spaceId: a.spaceId,
                  spaceName:
                    a.spaceName?.trim() || spaces.find((s) => s.id === a.spaceId)?.name?.trim() || "",
                }))
                .filter((a) => a.spaceName),
            )
          : Promise.resolve([]),
        conversationIdPromise,
        getSmsPermissionEvidenceForContact({
          venueId: lead.venueId,
          phone: lead.phone,
          leadId: lead.id,
          relationshipId: lead.relationshipId ?? null,
        }),
        getDuplicateReviewForLead(id),
        venue ? getTeamMembers(venue.id) : Promise.resolve([]),
        venue ? getCurrentStaffMember(venue.id) : Promise.resolve(null),
        venue ? isSmsConfigured(venue.id) : Promise.resolve(false),
        loadBookingJourneyForLead({
          leadId: lead.id,
          linkedClientId: lead.linkedClientId,
          linkedEventId: lead.linkedEventId ?? null,
        }),
        venue
          ? getContextualObservationsForRecord(venue.id, venue.timezone, { leadId: lead.id })
          : Promise.resolve([]),
        loadLeadFollowUpPresentation(lead),
        lead.relationshipId != null
          ? getRelationshipPhotoForVenue(lead.relationshipId)
          : Promise.resolve(null),
        lead.relationshipId != null
          ? import("@/lib/relationships/archive").then((m) =>
              m.getRelationshipArchiveState(lead.relationshipId!),
            )
          : Promise.resolve(null),
      ]);

      const conversationInternalNotes = await loadConversationInternalNotes(conversationId);

      let messageAttention: LeadMessageAttention | null = null;
      if (conversationId) {
        const supabase = await createClient();
        const { data: convo } = await supabase
          .from("conversations")
          .select("id, needs_response")
          .eq("id", conversationId)
          .maybeSingle<{ id: string; needs_response: boolean }>();
        if (convo?.needs_response) {
          messageAttention = {
            conversationId: convo.id,
            href: leadMessageAttentionHref(lead.id, convo.id),
          };
        }
      }

      const proactiveRecommended = followUpPresentation.proactiveRecommended;
      const contextualObservations = observationsForDraftSurface(
        rawObservations,
        proactiveRecommended,
        {
          proactiveRecommended,
          silence: isFollowUpSilenceBlock({
            proactiveRecommended,
            tour: followUpPresentation.tour,
            workflowIntent: followUpPresentation.workflowIntent,
          }),
        },
      );
      return {
        lead,
        holds,
        spaces,
        capacityRules,
        documents,
        workspaceDocuments,
        pinnedKeys,
        luvDrafts,
        documentsDeferred: !eagerDocuments,
        luvDraftsDeferred: !eagerLuvDrafts,
        tourAppointments,
        packages,
        conversationId,
        conversationInternalNotes,
        messageAttention,
        smsPermission,
        textingConfigured,
        duplicateReview,
        bookingJourney,
        contextualObservations,
        followUpDraftCapable: followUpPresentation.draftCapable,
        followUpDraftEligible: followUpPresentation.draftCapable,
        followUpDraftIneligibleReason: followUpPresentation.draftIneligibleReason,
        followUpProactiveRecommended: followUpPresentation.proactiveRecommended,
        venueStages: activeTemplate?.stages?.length ? activeTemplate.stages : null,
        staffOptions: teamMembers.map((m) => ({ id: m.id, name: m.name })),
        currentStaffId: currentStaff?.id ?? null,
        venueTimezone: venue?.timezone ?? null,
        spaceOperatingMode: venue?.spaceOperatingMode ?? "single",
        holdBlocksAvailability: venue?.holdBlocksAvailability !== false,
        spacePreferences,
        spaceAssignments,
        photo,
        archiveState,
      };
    })(),
    LEAD_DETAIL_LOAD_TIMEOUT_MS,
    "Lead detail",
  );

  if (!page) notFound();

  // Acknowledge unseen lead for the Leads nav attention badge (idempotent).
  // Does not clear conversations.needs_response (Decision C / Inbox contract).
  void markLeadVenueSeen(page.lead.id);

  // Computed server-side, not inside the client component — React Compiler
  // treats Date.now() as impure during render; see the identical pattern in
  // app/(app)/leads/page.tsx and app/(app)/clients/page.tsx.
  const now = new Date().toISOString();
  return (
    <LeadDetail
      lead={page.lead}
      now={now}
      relationshipArchived={Boolean(page.archiveState?.archivedAt)}
      holds={page.holds}
      spaces={page.spaces}
      maxSimultaneousEvents={effectiveMaxSimultaneousEvents(page.capacityRules)}
      documents={page.documents}
      workspaceDocuments={page.workspaceDocuments}
      pinnedDocumentKeys={[...page.pinnedKeys]}
      luvDrafts={page.luvDrafts}
      deferDocuments={page.documentsDeferred}
      deferLuvDrafts={page.luvDraftsDeferred}
      autoLuvDraft={autoLuvDraft}
      tourAppointments={page.tourAppointments}
      conversationId={page.conversationId}
      messageAttention={page.messageAttention}
      conversationInternalNotes={page.conversationInternalNotes}
      bookingJourney={page.bookingJourney}
      packages={page.packages}
      smsPermission={page.smsPermission}
      textingConfigured={page.textingConfigured}
      duplicateReview={page.duplicateReview}
      venueStages={page.venueStages}
      staffOptions={page.staffOptions}
      currentStaffId={page.currentStaffId}
      photoUrl={page.photo?.displayedPhotoUrl ?? null}
      venueTimezone={page.venueTimezone}
      contextualObservations={page.contextualObservations}
      followUpDraftCapable={page.followUpDraftCapable}
      followUpDraftEligible={page.followUpDraftEligible}
      followUpDraftIneligibleReason={page.followUpDraftIneligibleReason}
      followUpProactiveRecommended={page.followUpProactiveRecommended}
      spaceOperatingMode={page.spaceOperatingMode}
      holdBlocksAvailability={page.holdBlocksAvailability}
      spacePreferences={page.spacePreferences}
      spaceAssignments={page.spaceAssignments}
      openSetupPayments={setupPayments === "1"}
    />
  );
}
