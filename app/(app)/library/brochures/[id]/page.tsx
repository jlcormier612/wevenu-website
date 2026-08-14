import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrochureDetail } from "@/components/brochures/brochure-detail";
import { getBrochure } from "@/lib/brochures/service";
import { getLeads } from "@/lib/leads/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const brochure = await getBrochure(id);
  return { title: brochure?.name ?? "Brochure" };
}

export default async function BrochureDetailPage({ params }: Props) {
  const { id } = await params;
  const [brochure, leads] = await Promise.all([getBrochure(id), getLeads()]);
  if (!brochure) notFound();
  return <BrochureDetail brochure={brochure} leads={leads} />;
}
