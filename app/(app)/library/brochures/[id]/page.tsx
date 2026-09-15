import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BrochureDetail } from "@/components/brochures/brochure-detail";
import { getBrochure } from "@/lib/brochures/service";
import { getLeads } from "@/lib/leads/service";
import { getCurrentVenue } from "@/lib/venue/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const brochure = await getBrochure(id);
  return { title: brochure?.name ?? "Brochure" };
}

export default async function BrochureDetailPage({ params }: Props) {
  const { id } = await params;
  const [brochure, leads, venue] = await Promise.all([getBrochure(id), getLeads(), getCurrentVenue()]);
  if (!brochure) notFound();
  return (
    <BrochureDetail
      brochure={brochure}
      leads={leads}
      venueId={venue?.id ?? brochure.venueId}
      venueHeroUrl={venue?.heroImageUrl ?? null}
    />
  );
}
