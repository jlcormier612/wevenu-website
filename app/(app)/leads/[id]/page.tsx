import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/leads/lead-detail";
import { withTimeout } from "@/lib/async/with-timeout";
import { getHolds, getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";
import { loadBookingJourneyForLead } from "@/lib/booking-journey/load";
import { getDocuments } from "@/lib/documents/service";
import { getPinnedDocumentKeys, getRecentInteractionMap, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import { getDraftsForLead } from "@/lib/luv/drafts";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead } from "@/lib/leads/service";
import { getPackagesWithItems } from "@/lib/packages/service";
import { getTourAppointmentsForLead } from "@/lib/tours/service";
import { getConversationIdForRelationship } from "@/lib/conversations/service";
import { getSmsPermissionEvidenceForContact } from "@/lib/communication/contact-permission-view";
import { getDuplicateReviewForLead } from "@/lib/leads/duplicate-review";

/** Fail the route instead of leaving app/(app)/loading.tsx stuck forever. */
const LEAD_DETAIL_LOAD_TIMEOUT_MS = 45_000;

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ luv?: string }> };

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
  const { luv: luvParam } = await searchParams;
  const autoLuvDraft = normalizeAutoLuvDraft(luvParam);

  const page = await withTimeout(
    (async () => {
      const [lead, holds, spaces, capacityRules, documents, workspaceDocuments, pinnedKeys, recentMap, luvDrafts, tourAppointments, packages] = await Promise.all([
        getLead(id),
        getHolds({ leadId: id }),
        getSpaces(),
        getCapacityRules(),
        getDocuments("lead", id),
        getVenueWorkspaceDocuments({ leadId: id }),
        getPinnedDocumentKeys(),
        getRecentInteractionMap(),
        getDraftsForLead(id),
        getTourAppointmentsForLead(id),
        getPackagesWithItems(true),
      ]);
      if (!lead) return null;
      const [conversationId, smsPermission, duplicateReview] = await Promise.all([
        lead.relationshipId
          ? getConversationIdForRelationship(lead.relationshipId)
          : Promise.resolve(null),
        getSmsPermissionEvidenceForContact({ venueId: lead.venueId, phone: lead.phone }),
        getDuplicateReviewForLead(id),
      ]);
      const bookingJourney = await loadBookingJourneyForLead({
        leadId: lead.id,
        linkedClientId: lead.linkedClientId,
        linkedEventId: lead.linkedEventId ?? null,
      });
      return {
        lead,
        holds,
        spaces,
        capacityRules,
        documents,
        workspaceDocuments,
        pinnedKeys,
        recentMap,
        luvDrafts,
        tourAppointments,
        packages,
        conversationId,
        smsPermission,
        duplicateReview,
        bookingJourney,
      };
    })(),
    LEAD_DETAIL_LOAD_TIMEOUT_MS,
    "Lead detail",
  );

  if (!page) notFound();

  // Computed server-side, not inside the client component — React Compiler
  // treats Date.now() as impure during render; see the identical pattern in
  // app/(app)/leads/page.tsx and app/(app)/clients/page.tsx.
  const now = new Date().toISOString();
  return (
    <LeadDetail
      lead={page.lead}
      now={now}
      holds={page.holds}
      spaces={page.spaces}
      maxSimultaneousEvents={effectiveMaxSimultaneousEvents(page.capacityRules)}
      documents={page.documents}
      workspaceDocuments={page.workspaceDocuments}
      pinnedDocumentKeys={[...page.pinnedKeys]}
      recentDocumentEntries={[...page.recentMap.entries()]}
      luvDrafts={page.luvDrafts}
      autoLuvDraft={autoLuvDraft}
      tourAppointments={page.tourAppointments}
      conversationId={page.conversationId}
      bookingJourney={page.bookingJourney}
      packages={page.packages}
      smsPermission={page.smsPermission}
      duplicateReview={page.duplicateReview}
    />
  );
}
