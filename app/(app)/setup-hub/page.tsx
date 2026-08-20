import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SetupHubOverview } from "@/components/setup-hub/setup-hub-overview";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { getImportBatches } from "@/lib/import/batches";
import { getQuickBooksConnection } from "@/lib/quickbooks/service";
import { getLeadCaptureStageStatus, getSetupHubState } from "@/lib/setup-hub/service";
import { getTeamMembers } from "@/lib/team/service";
import { getTourSettings } from "@/lib/tours/service";
import { getCurrentVenue, getSetupReadyCounts } from "@/lib/venue/service";
import { computeOperationalReadiness } from "@/lib/operational-readiness/compute";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupHubPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [
    hubState, leadCapture, spaces, capacityRules, tourSettings,
    importBatches, readyCounts, teamMembers, quickbooksConnection, operationalReadiness,
  ] = await Promise.all([
    getSetupHubState(),
    getLeadCaptureStageStatus(),
    getSpaces(),
    getCapacityRules(),
    getTourSettings(),
    getImportBatches(),
    getSetupReadyCounts(venue.id),
    getTeamMembers(venue.id),
    getQuickBooksConnection(),
    computeOperationalReadiness(venue.id),
  ]);

  const activeTeamCount = teamMembers.filter((m) => !m.isOwner && m.isActive && m.acceptedAt).length;
  const hasImportedData = importBatches.some((b) => !b.rolledBackAt && b.importedCount > 0);
  const owner = teamMembers.find((m) => m.isOwner);
  const ownerFirstName = owner?.name?.split(" ")[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup"
        description="Set up your venue at your own pace. Every area here can be revisited and edited any time — nothing here is final until you say so."
      />
      <SetupHubOverview
        venueName={venue.name}
        ownerFirstName={ownerFirstName}
        hubState={hubState}
        leadCapture={leadCapture}
        spacesCount={spaces.length}
        hasCapacityRules={capacityRules != null}
        tourSchedulingEnabled={tourSettings?.tourSchedulingEnabled ?? false}
        hasImportedData={hasImportedData}
        readyCounts={readyCounts}
        activeTeamCount={activeTeamCount}
        stripeConnected={venue.stripeOnboardingStatus === "connected"}
        quickbooksConnected={quickbooksConnection?.status === "connected"}
        operationalReadiness={operationalReadiness}
      />
    </div>
  );
}
