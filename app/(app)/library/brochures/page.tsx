import type { Metadata } from "next";

import { NewBrochureSheet, BrochureList } from "@/components/brochures/brochure-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getBrochures } from "@/lib/brochures/service";

export const metadata: Metadata = { title: "Brochures" };

export default async function BrochuresPage() {
  const { ensureBrochureStartersForCurrentVenue } = await import("@/lib/brochures/provision");
  await ensureBrochureStartersForCurrentVenue();
  const brochures = await getBrochures(true);
  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Brochures"
          description="Reusable, brandable overviews of your venue to share with prospective couples. Customize your Hello to Cheers starter, then share when you're ready."
          actions={<NewBrochureSheet />}
        />
      </div>
      <LibraryHowItWorks tone="calm">
        Edit and preview here. Share with a lead from the brochure detail — Share emails a view link.
      </LibraryHowItWorks>
      <BrochureList brochures={brochures} headerCreate={false} />
    </div>
  );
}
