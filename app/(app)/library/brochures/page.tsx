import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { BrochureList } from "@/components/brochures/brochure-list";
import { getBrochures } from "@/lib/brochures/service";

export const metadata: Metadata = { title: "Brochures" };

export default async function BrochuresPage() {
  const { ensureBrochureStartersForCurrentVenue } = await import("@/lib/brochures/provision");
  await ensureBrochureStartersForCurrentVenue();
  const brochures = await getBrochures(true);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Brochures"
        description="Reusable, brandable overviews of your venue to share with prospective couples. Customize your Hello to Cheers starter, then share when you're ready."
      />
      <BrochureList brochures={brochures} />
    </div>
  );
}
