import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/shell/module-placeholder";
import { BringYourBusinessGuide } from "@/components/setup-hub/bring-your-business-guide";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { getVenueDocuments } from "@/lib/documents/service";
import { getImportBatches } from "@/lib/import/batches";
import { evaluateCutoverPrerequisites } from "@/lib/setup-hub/bring-your-business";
import { evaluateGuideProgress } from "@/lib/setup-hub/bring-your-business-guide";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Bring Your Business — Setup" };
export const dynamic = "force-dynamic";

export default async function BringYourBusinessGuidePage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [hubState, spaces, capacityRules, importBatches, venueDocuments] = await Promise.all([
    getSetupHubState(),
    getSpaces(),
    getCapacityRules(),
    getImportBatches(),
    getVenueDocuments(),
  ]);

  const hasMigrationImport = importBatches.some(
    (b) => !b.rolledBackAt && b.importedCount > 0 && Boolean(b.migrationSessionId),
  );
  const uploadedMaterialsCount = venueDocuments.filter((d) => d.tags.includes("setup_import")).length;
  const cutover = evaluateCutoverPrerequisites({
    spacesCount: spaces.length,
    hasCapacityRules: capacityRules != null,
    maxSimultaneousEvents: capacityRules?.maxSimultaneousEvents ?? null,
  });
  const progress = evaluateGuideProgress({
    batches: importBatches,
    hasMigrationImport,
    uploadedMaterialsCount,
    path: hubState?.bringYourBusinessPath ?? null,
  });
  const isWhiteGlove = hubState?.onboardingType === "white_glove";

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Bring Your Business"
          description="A guided path over the import tools you already have — clients, events, finances, and planning materials, in an order that keeps records connected."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href="/setup-hub" className="hover:text-foreground hover:underline">
          Setup
        </Link>
        {" · "}
        Bring Your Business
      </p>
      <BringYourBusinessGuide
        progress={progress}
        cutover={cutover}
        isWhiteGlove={isWhiteGlove}
      />
    </div>
  );
}
