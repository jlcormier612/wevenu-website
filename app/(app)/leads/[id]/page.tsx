import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadDetail } from "@/components/leads/lead-detail";
import { getHolds, getSpaces } from "@/lib/availability/service";
import { leadDisplayName } from "@/lib/leads/constants";
import { getLead } from "@/lib/leads/service";

type Props = { params: Promise<{ id: string }> };

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

export default async function LeadDetailPage({ params }: Props) {
  const { id } = await params;
  const [lead, holds, spaces] = await Promise.all([
    getLead(id),
    getHolds({ leadId: id }),
    getSpaces(),
  ]);
  if (!lead) notFound();
  return <LeadDetail lead={lead} holds={holds} spaces={spaces} />;
}
