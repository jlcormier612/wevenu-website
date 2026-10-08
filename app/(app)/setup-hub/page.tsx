import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SetupHubOverview } from "@/components/setup-hub/setup-hub-overview";
import { getSpaces, getCapacityRules } from "@/lib/availability/service";
import { getVenueDocuments } from "@/lib/documents/service";
import { getImportBatches } from "@/lib/import/batches";
import { getQuickBooksConnection } from "@/lib/quickbooks/service";
import { getLeadCaptureStageStatus, getSetupHubState } from "@/lib/setup-hub/service";
import { getTeamMembers } from "@/lib/team/service";
import { getTourSettings } from "@/lib/tours/service";
import { getCurrentVenue, getSetupReadyCounts, getVenueSettings } from "@/lib/venue/service";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { loadSetupConciergeEntry } from "@/lib/setup-concierge/load";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

export default async function SetupHubPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [
    hubState, leadCapture, spaces, capacityRules, tourSettings,
    importBatches, readyCounts, teamMembers, quickbooksConnection, setupConcierge, venueDocuments, venueSettings, intake,
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
    loadSetupConciergeEntry(),
    getVenueDocuments(),
    getVenueSettings(),
    getIntakeForVenue(venue.id),
  ]);

  // Team Setup Hub completion: only deliberate Team/Owners actions (invited_by set).
  // Purchase/onboarding purchaser + activate-path owner rows leave invited_by null.
  const deliberateTeamActionCount = teamMembers.filter(
    (m) => m.isActive && Boolean(m.invitedByUserId),
  ).length;
  const hasMigrationImport = importBatches.some(
    (b) => !b.rolledBackAt && b.importedCount > 0 && Boolean(b.migrationSessionId),
  );
  // Raw files tagged setup_import that haven't been turned into a real Contract /
  // Message Template / Playbook yet — see the client-experience stage nudge.
  const uploadedMaterialsCount = venueDocuments.filter((d) => d.tags.includes("setup_import")).length;
  const owner = teamMembers.find((m) => m.isOwner);
  const ownerFirstName = owner?.name?.split(" ")[0] ?? null;
  const isWhiteGlove = hubState?.onboardingType === "white_glove";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup"
        description={
          isWhiteGlove
            ? "We've already done a lot of the setup for you. There are just a few things we'd like you to review before you're ready to invite couples."
            : "Set up your venue at your own pace. Every area here can be revisited and edited any time — nothing here is final until you say so."
        }
      />
      {isWhiteGlove ? (
        <div className="rounded-md border bg-muted/30 p-4">
          <h2 className="text-lg font-medium">Welcome to Hello to Cheers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ve already done a lot of the setup for you.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are just a few things we&apos;d like you to review before you&apos;re ready
            to invite couples.
          </p>
        </div>
      ) : null}
      <SetupHubOverview
        venueName={venue.name}
        ownerFirstName={ownerFirstName}
        hubState={hubState}
        leadCapture={leadCapture}
        spacesCount={spaces.length}
        hasCapacityRules={capacityRules != null}
        tourSchedulingEnabled={tourSettings?.tourSchedulingEnabled ?? false}
        hasMigrationImport={hasMigrationImport}
        readyCounts={readyCounts}
        uploadedMaterialsCount={uploadedMaterialsCount}
        deliberateTeamActionCount={deliberateTeamActionCount}
        stripeConnected={venue.stripeOnboardingStatus === "connected"}
        quickbooksConnected={quickbooksConnection?.status === "connected"}
        setupConcierge={setupConcierge}
        maxSimultaneousEvents={capacityRules?.maxSimultaneousEvents ?? null}
        spaceOperatingMode={venue.spaceOperatingMode}
        yourVenueFacts={{
          name: venue.name,
          email: venue.email,
          phone: venue.phone,
          businessHours: venueSettings?.input.businessHours ?? [],
          logoUrl: venue.logoUrl,
          heroImageUrl: venue.heroImageUrl,
          primaryColor: venue.primaryColor,
        }}
        intakeBringBusinessChoice={intake?.bringBusinessChoice ?? null}
      />
    </div>
  );
}
