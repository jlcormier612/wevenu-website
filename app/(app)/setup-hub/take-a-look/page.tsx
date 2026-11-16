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
import { buildPhaseAMilestones } from "@/lib/setup-hub/phase-a-milestones";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Take a look, then go live — Setup" };
export const dynamic = "force-dynamic";

export default async function TakeALookPage() {
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

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="04"
        title="Take a look, then go live"
        intro="Everything is coming together! Before you invite your clients, let's walk through a sample wedding so you can see how Hello to Cheers will work for you and the people you serve."
        statusLabel={milestones[3]?.statusLabel}
      >
        <MilestoneGuidancePanel title="See what your clients will experience.">
          Review your venue&apos;s branded client portal, planning resources, and booking experience
          before you invite anyone.
        </MilestoneGuidancePanel>

        <MilestoneStepCard
          title="Walk through a sample wedding"
          description="Explore the venue and client experience without affecting real bookings."
          action={
            <Button
              type="button"
              variant="outline"
              render={<Link href="/settings/leads/setup-profiles" />}
            >
              Review Setup Profiles
            </Button>
          }
        />

        <MilestoneStepCard
          title="Review your readiness"
          description="Check your calendar, business setup, client experience, and communications."
          action={
            <Button type="button" variant="outline" render={<Link href="/setup-hub" />}>
              Back to your setup
            </Button>
          }
        />

        <MilestoneStepCard
          title="Choose what to activate"
          description="Turn on public forms, automations, invitations, and payments when you're comfortable."
          action={
            <Button type="button" disabled data-testid="phase-a-finish-disabled">
              Finish setup &amp; go to Dashboard
            </Button>
          }
        />
      </MilestoneDetailShell>
    </div>
  );
}
