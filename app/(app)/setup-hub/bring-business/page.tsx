import type { Metadata } from "next";
import Link from "next/link";

import {
  MilestoneDetailShell,
  MilestoneGuidancePanel,
  MilestoneStepCard,
} from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/availability/service";
import { getImportBatches } from "@/lib/import/batches";
import { BRING_YOUR_BUSINESS_ROUTES } from "@/lib/setup-hub/bring-your-business";
import {
  SETUP_HUB_MILESTONE_RETURN,
  withSetupHubReturn,
} from "@/lib/setup-hub/phase-b1-routes";
import {
  bringBusinessNothingToBringOver,
  buildPhaseAMilestones,
} from "@/lib/setup-hub/phase-a-milestones";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Bring your business over — Setup" };
export const dynamic = "force-dynamic";

export default async function BringBusinessPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const [hubState, spaces, importBatches] = await Promise.all([
    getSetupHubState(),
    getSpaces(),
    getImportBatches(),
  ]);
  const hasMigrationImport = importBatches.some(
    (b) => !b.rolledBackAt && b.importedCount > 0 && Boolean(b.migrationSessionId),
  );
  const milestones = buildPhaseAMilestones({
    hubState,
    spacesCount: spaces.length,
    hasMigrationImport,
    venueBrandStarted: false,
    setupProfileCount: 0,
  });
  const nothingToBringOver = bringBusinessNothingToBringOver({
    existingBookingsAnswer: hubState?.existingBookingsAnswer ?? null,
    hasMigrationImport,
    bringYourBusinessPath: hubState?.bringYourBusinessPath ?? null,
  });

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="03"
        title="Bring your business over"
        intro="Already have weddings on the calendar? We'll help you bring your business into Hello to Cheers while keeping your existing bookings, important details, and commitments organized."
        statusLabel={milestones[2]?.statusLabel}
      >
        {nothingToBringOver ? (
          <div data-testid="phase-a-nothing-to-bring-over">
            <MilestoneGuidancePanel title="Nothing to bring over">
              You&apos;re all set here. If you have records to add later, you can still use{" "}
              <Link
                href={withSetupHubReturn(
                  BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport,
                  undefined,
                  SETUP_HUB_MILESTONE_RETURN.bringBusiness,
                )}
                className="font-medium text-primary underline-offset-4 hover:underline"
                data-testid="phase-a-import-data"
              >
                Import Data
              </Link>
              .
            </MilestoneGuidancePanel>
          </div>
        ) : (
          <MilestoneGuidancePanel title="Before importing booked events">
            Make sure your spaces and booking rules are configured first. This helps us assign your
            existing bookings correctly and protect your calendar.
          </MilestoneGuidancePanel>
        )}

        <MilestoneStepCard
          title="Leads"
          description="Bring over prospective customers and their inquiry details."
        />
        <MilestoneStepCard
          title="Clients & booked Events"
          description="Keep booked clients connected to their events, spaces, and dates."
        />
        <MilestoneStepCard
          title="Existing commitments"
          description="Review contracts, invoices, deposits, and payment schedules where supported."
        />
        <MilestoneStepCard
          title="Vendors"
          description="Bring over the vendor relationships your venue works with."
        />
        <MilestoneStepCard
          title="Review your import"
          description="Confirm what transferred and resolve anything needing attention."
        />

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-heading">Migration Center</p>
            <p className="text-sm text-muted-foreground">
              Open the existing Migration Center for cutover imports. Smaller contact or template
              lists can still use Import Data.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              render={
                <Link
                  href={withSetupHubReturn(
                    BRING_YOUR_BUSINESS_ROUTES.migrationCenter,
                    undefined,
                    SETUP_HUB_MILESTONE_RETURN.bringBusiness,
                  )}
                />
              }
              data-testid="phase-a-open-migration"
            >
              Open Migration Center
            </Button>
            <Button
              type="button"
              variant="outline"
              render={
                <Link
                  href={withSetupHubReturn(
                    BRING_YOUR_BUSINESS_ROUTES.spreadsheetImport,
                    undefined,
                    SETUP_HUB_MILESTONE_RETURN.bringBusiness,
                  )}
                  data-testid="phase-a-import-data-button"
                />
              }
            >
              Import Data
            </Button>
          </div>
        </div>

        {hubState?.existingBookingsAnswer === "yes" && !hasMigrationImport ? (
          <p className="text-sm text-muted-foreground" data-testid="phase-a-migration-pending">
            Calendar readiness stays pending until booked events are imported and space assignments
            can be verified. Import records alone are not treated as verified reconciliation.
          </p>
        ) : null}
      </MilestoneDetailShell>
    </div>
  );
}
