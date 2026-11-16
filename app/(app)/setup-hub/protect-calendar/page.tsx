import type { Metadata } from "next";
import Link from "next/link";

import { ExistingBookingsForm } from "@/components/setup-hub/phase-a/existing-bookings-form";
import { MarkBookingRulesLink } from "@/components/setup-hub/phase-a/mark-booking-rules-link";
import {
  MilestoneDetailShell,
  MilestoneGuidancePanel,
  MilestoneStepCard,
} from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/availability/service";
import { getImportBatches } from "@/lib/import/batches";
import {
  buildPhaseAMilestones,
  PHASE_A_MILESTONE_ROUTES,
} from "@/lib/setup-hub/phase-a-milestones";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Protect your calendar — Setup" };
export const dynamic = "force-dynamic";

export default async function ProtectCalendarPage() {
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
  const statusLabel = milestones[0]?.statusLabel;
  const spacesHref =
    spaces.length === 0
      ? "/settings/availability?focus=spaces&add=1"
      : "/settings/availability?focus=spaces";
  const spacesActionLabel = spaces.length === 0 ? "Add your first space" : "Manage your spaces";
  const calendarReady = milestones[0]?.status === "ready";

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="01"
        title="Protect your calendar"
        intro="Before you begin managing bookings, let's make sure your spaces and availability reflect how your venue operates."
        statusLabel={statusLabel}
      >
        <MilestoneGuidancePanel>
          Accurate spaces and existing bookings help protect your venue from scheduling conflicts and
          double-bookings.
        </MilestoneGuidancePanel>

        <MilestoneStepCard
          title="Your spaces"
          description="Add the spaces you host events in and their guest capacities."
          action={
            <Button type="button" render={<Link href={spacesHref} />} data-testid="phase-a-spaces-cta">
              {spacesActionLabel}
            </Button>
          }
        >
          <p className="text-xs text-muted-foreground">
            {spaces.length === 0
              ? "You don't have any spaces yet. Start here before importing dated events."
              : `You have ${spaces.length} space${spaces.length === 1 ? "" : "s"} configured.`}
          </p>
        </MilestoneStepCard>

        <MilestoneStepCard
          title="Booking & availability rules"
          description="Decide how spaces can be used together and when events or tours may overlap."
          action={
            <MarkBookingRulesLink href="/settings/availability?focus=rules" />
          }
        >
          {hubState?.bookingRulesReviewedAt ? (
            <p className="text-xs text-muted-foreground">Booking rules marked as reviewed.</p>
          ) : null}
        </MilestoneStepCard>

        <MilestoneStepCard
          title="Your existing bookings"
          description="Tell us whether you have booked events to bring into HTC."
          action={
            <Button
              type="button"
              variant="outline"
              render={<Link href="#existing-bookings" />}
            >
              Review existing bookings
            </Button>
          }
        >
          <div id="existing-bookings" className="scroll-mt-24">
            <ExistingBookingsForm initialAnswer={hubState?.existingBookingsAnswer ?? null} />
          </div>
        </MilestoneStepCard>

        <MilestoneStepCard
          title="Calendar readiness"
          description="Confirm your spaces, existing bookings, and availability are accurately represented."
          action={
            calendarReady ? (
              <Button type="button" variant="outline" disabled>
                Calendar ready
              </Button>
            ) : (
              <Button
                type="button"
                render={<Link href={PHASE_A_MILESTONE_ROUTES.bringBusiness} />}
                data-testid="phase-a-calendar-continue-migration"
              >
                Continue to Bring your business over
              </Button>
            )
          }
        >
          {!calendarReady ? (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm">
              <p className="font-medium text-heading">Your calendar isn&apos;t ready just yet.</p>
              <p className="mt-1 text-muted-foreground">
                Once your booked events are brought over and their spaces are confirmed, we&apos;ll
                help you verify your availability.
              </p>
              {hubState?.existingBookingsAnswer === "yes" ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Status: Needs attention — migration and space assignment reconciliation are
                  required before this milestone can show Ready.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Spaces, booking rules, and your existing-bookings answer are in place for a clear
              calendar start.
            </p>
          )}
        </MilestoneStepCard>
      </MilestoneDetailShell>
    </div>
  );
}
