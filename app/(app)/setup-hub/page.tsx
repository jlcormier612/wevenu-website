import type { Metadata } from "next";

import { StarterProvisioningBanner } from "@/components/library/starter-provisioning-banner";
import { SetupHubPhaseAOverview } from "@/components/setup-hub/phase-a/setup-hub-phase-a-overview";
import { getSpaces } from "@/lib/availability/service";
import { getImportBatches } from "@/lib/import/batches";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import { getStarterProvisioningSnapshot } from "@/lib/provisioning/starters";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupHubPage() {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;

  const [spaces, importBatches, starterProvisioning] = await Promise.all([
    getSpaces(),
    getImportBatches(),
    getStarterProvisioningSnapshot(ctx.venue.id),
  ]);

  // Migration Center import with durable rows — not spreadsheet/HQ ad-hoc batches.
  const hasMigrationImport = importBatches.some(
    (b) => !b.rolledBackAt && b.importedCount > 0 && Boolean(b.migrationSessionId),
  );

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      {starterProvisioning.needsAttention ? (
        <StarterProvisioningBanner snapshot={starterProvisioning} />
      ) : null}
      <SetupHubPhaseAOverview
        hubState={ctx.hubState}
        spacesCount={spaces.length}
        hasMigrationImport={hasMigrationImport}
        venueBrandStarted={ctx.venueBrandStarted}
        setupProfileCount={ctx.profiles.length}
        packages={ctx.packages}
        contractStarterCount={ctx.contractStarterCount}
        setupProfileAssignments={ctx.assignments}
        setupProfiles={ctx.profiles}
        messageTemplateCount={ctx.messageTemplateCount}
        pausedAutomationCount={ctx.pausedAutomationCount}
        operationalStarterAvailable={ctx.operationalStarterAvailable}
      />
    </div>
  );
}
