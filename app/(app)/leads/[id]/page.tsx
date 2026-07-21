import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/leads/lead-detail";
import { getHolds, getSpaces } from "@/lib/availability/service";
import { getDocuments } from "@/lib/documents/service";
import { getDraftsForLead } from "@/lib/luv/drafts";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead, getLeadPipelineStageId } from "@/lib/leads/service";
import { resolvePipelineStageForLead } from "@/lib/leads/pipeline-stage-mapping";
import { getTourAppointmentsForLead } from "@/lib/tours/service";
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
  const [lead, holds, spaces, documents, luvDrafts, tourAppointments, activeTemplate, explicitStageId] = await Promise.all([
    getLead(id),
    getHolds({ leadId: id }),
    getSpaces(),
    getDocuments("lead", id),
    getDraftsForLead(id),
    getTourAppointmentsForLead(id),
    getActiveTemplate(),
    getLeadPipelineStageId(id),
  ]);
  if (!lead) notFound();
  const conversationId = lead.relationshipId
    ? await getConversationIdForRelationship(lead.relationshipId)
    : null;
  // Phase 2 compatibility layer (docs/booking-journey-design.md) — leads.status
  // is still the enforced field; this only decides what to *display*.
  const pipelineStages = activeTemplate?.stages ?? [];
  const currentPipelineStage = pipelineStages.length > 0
    ? resolvePipelineStageForLead(lead.status, explicitStageId, pipelineStages)
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
      documents={documents}
      luvDrafts={luvDrafts}
      autoLuvDraft={autoLuvDraft}
      tourAppointments={tourAppointments}
      conversationId={conversationId}
      pipelineStages={pipelineStages}
      currentPipelineStage={currentPipelineStage}
    />
  );
}
