import type { Metadata } from "next";
import { Suspense } from "react";

import { StarterProvisioningBanner } from "@/components/library/starter-provisioning-banner";
import { SetupHubPhaseAOverview } from "@/components/setup-hub/phase-a/setup-hub-phase-a-overview";
import { NavListBodyFallback } from "@/components/shell/nav-list-body-fallback";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getSpaces } from "@/lib/availability/service";
import { phaseAImportFlags } from "@/lib/import/activity";
import { getImportBatches } from "@/lib/import/batches";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import { getStarterProvisioningSnapshot } from "@/lib/provisioning/starters";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

async function SetupBodyIsland() {
  const ctx = await loadMilestone02Context();
  if (!ctx) {
    return <p className="text-sm text-muted-foreground">Select a venue to continue setup.</p>;
  }

  const [spaces, importBatches, starterProvisioning] = await Promise.all([
    getSpaces(),
    getImportBatches(),
    getStarterProvisioningSnapshot(ctx.venue.id),
  ]);

  const { hasImportedActivity, hasMigrationImport } = phaseAImportFlags(importBatches);

  return (
    <>
      {starterProvisioning.needsAttention ? (
        <StarterProvisioningBanner snapshot={starterProvisioning} />
      ) : null}
      <SetupHubPhaseAOverview
        hubState={ctx.hubState}
        spacesCount={spaces.length}
        hasMigrationImport={hasMigrationImport}
        hasImportedActivity={hasImportedActivity}
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
    </>
  );
}

export default function SetupHubPage() {
  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6" data-testid="setup-streaming-root">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Setup"
          description="Get your venue ready — brand, booking process, and the tools you use every day."
        />
      </div>
      <Suspense fallback={<NavListBodyFallback label="Loading setup" />}>
        <SetupBodyIsland />
      </Suspense>
    </div>
  );
}
