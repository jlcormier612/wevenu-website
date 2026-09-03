import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/leads/lead-detail";
import { getHolds, getSpaces, getCapacityRules } from "@/lib/availability/service";
import { effectiveMaxSimultaneousEvents } from "@/lib/availability/event-occupancy";
import { getDocuments } from "@/lib/documents/service";
import { getPinnedDocumentKeys, getRecentInteractionMap, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
import { getDraftsForLead } from "@/lib/luv/drafts";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead } from "@/lib/leads/service";
import { getTourAppointmentsForLead } from "@/lib/tours/service";
import { getConversationIdForRelationship } from "@/lib/conversations/service";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ luv?: string }> };

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
  const { luv: autoLuvDraft } = await searchParams;
  const [lead, holds, spaces, capacityRules, documents, workspaceDocuments, pinnedKeys, recentMap, luvDrafts, tourAppointments] = await Promise.all([
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
  ]);
  if (!lead) notFound();
  const conversationId = lead.relationshipId
    ? await getConversationIdForRelationship(lead.relationshipId)
    : null;
  // Computed server-side, not inside the client component — React Compiler
  // treats Date.now() as impure during render; see the identical pattern in
  // app/(app)/leads/page.tsx and app/(app)/clients/page.tsx.
  const now = new Date().toISOString();
  return (
    <LeadDetail
      lead={lead}
      now={now}
      holds={holds}
      spaces={spaces}
      maxSimultaneousEvents={effectiveMaxSimultaneousEvents(capacityRules)}
      documents={documents}
      workspaceDocuments={workspaceDocuments}
      pinnedDocumentKeys={[...pinnedKeys]}
      recentDocumentEntries={[...recentMap.entries()]}
      luvDrafts={luvDrafts}
      autoLuvDraft={autoLuvDraft}
      tourAppointments={tourAppointments}
      conversationId={conversationId}
    />
  );
}
