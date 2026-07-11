import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/leads/lead-detail";
import { getHolds, getSpaces } from "@/lib/availability/service";
import { getDocuments } from "@/lib/documents/service";
import { getDraftsForLead } from "@/lib/luv/drafts";
import { getThreadsForEntity } from "@/lib/messaging/service";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead, getLeadPipelineStageId } from "@/lib/leads/service";
import { resolvePipelineStageForLead } from "@/lib/leads/pipeline-stage-mapping";
import { getTourAppointmentsForLead } from "@/lib/tours/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { getConversationIdForRelationship } from "@/lib/conversations/service";
import { getActiveTemplate } from "@/lib/pipeline-templates/service";

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
  const [lead, holds, spaces, documents, luvDrafts, threads, tourAppointments, venue, activeTemplate, explicitStageId] = await Promise.all([
    getLead(id),
    getHolds({ leadId: id }),
    getSpaces(),
    getDocuments("lead", id),
    getDraftsForLead(id),
    getThreadsForEntity("lead", id),
    getTourAppointmentsForLead(id),
    getCurrentVenue(),
    getActiveTemplate(),
    getLeadPipelineStageId(id),
  ]);
  if (!lead) notFound();
  const conversationExperienceEnabled = venue?.conversationExperienceEnabled ?? false;
  const conversationId = conversationExperienceEnabled && lead.relationshipId
    ? await getConversationIdForRelationship(lead.relationshipId)
    : null;
  // Phase 2 compatibility layer (docs/booking-journey-design.md) — leads.status
  // is still the enforced field; this only decides what to *display*.
  const pipelineStages = activeTemplate?.stages ?? [];
  const currentPipelineStage = pipelineStages.length > 0
    ? resolvePipelineStageForLead(lead.status, explicitStageId, pipelineStages)
    : null;
  return (
    <LeadDetail
      lead={lead}
      holds={holds}
      spaces={spaces}
      documents={documents}
      luvDrafts={luvDrafts}
      threads={threads}
      autoLuvDraft={autoLuvDraft}
      tourAppointments={tourAppointments}
      conversationExperienceEnabled={conversationExperienceEnabled}
      conversationId={conversationId}
      pipelineStages={pipelineStages}
      currentPipelineStage={currentPipelineStage}
    />
  );
}
