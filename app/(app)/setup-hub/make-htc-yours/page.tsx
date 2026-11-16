import type { Metadata } from "next";
import Link from "next/link";

import {
  MilestoneDetailShell,
  MilestoneStepCard,
} from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/availability/service";
import { getImportBatches } from "@/lib/import/batches";
import { buildPhaseAMilestones } from "@/lib/setup-hub/phase-a-milestones";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import { SECTION_STATUS_LABEL } from "@/lib/setup-hub/phase-b1-readiness";
import { PHASE_B1_M02_ROUTES } from "@/lib/setup-hub/phase-b1-routes";

export const metadata: Metadata = { title: "Make HTC yours — Setup" };
export const dynamic = "force-dynamic";

export default async function MakeHtcYoursPage() {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;

  const [spaces, importBatches] = await Promise.all([getSpaces(), getImportBatches()]);
  const hasMigrationImport = importBatches.some(
    (b) => !b.rolledBackAt && b.importedCount > 0 && Boolean(b.migrationSessionId),
  );
  const milestones = buildPhaseAMilestones({
    hubState: ctx.hubState,
    spacesCount: spaces.length,
    hasMigrationImport,
    venueBrandStarted: ctx.venueBrandStarted,
    setupProfileCount: ctx.profiles.length,
    packages: ctx.packages,
    contractStarterCount: ctx.contractStarterCount,
    setupProfileAssignments: ctx.assignments,
    setupProfiles: ctx.profiles,
    messageTemplateCount: ctx.messageTemplateCount,
    pausedAutomationCount: ctx.pausedAutomationCount,
    operationalStarterAvailable: ctx.operationalStarterAvailable,
  });

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="02"
        title="Make HTC yours"
        intro="We've given you a head start with ready-to-personalize templates and planning resources. Let's make them fit the way your venue works."
        statusLabel={milestones[1]?.statusLabel}
      >
        <MilestoneStepCard
          title="Your venue & brand"
          description="Make it yours."
          statusLabel={SECTION_STATUS_LABEL[ctx.sections.brand]}
          action={
            <Button
              type="button"
              render={<Link href={PHASE_B1_M02_ROUTES.venueBrand} />}
              data-testid="phase-a-personalize-brand"
            >
              Personalize your brand
            </Button>
          }
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-heading">Your venue details</p>
              <p className="text-sm text-muted-foreground">
                Review the name, contact information, and details clients should recognize as yours.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={<Link href={PHASE_B1_M02_ROUTES.venueDetails} />}
                data-testid="phase-b1-venue-details"
              >
                Review venue details
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-heading">Your look &amp; feel</p>
              <p className="text-sm text-muted-foreground">
                Add your logo and colors so your workspace and client-facing materials feel like you.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={<Link href={PHASE_B1_M02_ROUTES.lookAndFeel} />}
                data-testid="phase-b1-look-and-feel"
              >
                Review look &amp; feel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground" data-testid="phase-a-venue-brand-state">
              {ctx.hubState?.yourVenueReviewedAt
                ? "Venue details saved."
                : ctx.venue.phone || ctx.venue.addressLine1
                  ? "In progress — add or confirm your venue details."
                  : "Not started — provisioned name only is not treated as complete."}
            </p>
          </div>
        </MilestoneStepCard>

        <MilestoneStepCard
          title="Your booking process"
          description="Prepare your offerings, contracts, and payment arrangements."
          statusLabel={SECTION_STATUS_LABEL[ctx.sections.booking]}
          action={
            <Button
              type="button"
              render={<Link href={PHASE_B1_M02_ROUTES.bookingProcess} />}
              data-testid="phase-b1-setup-booking"
            >
              Set up your booking process
            </Button>
          }
        />

        <MilestoneStepCard
          title="Your event experiences"
          description="Choose the events you host and prepare the experience for each one."
          statusLabel={SECTION_STATUS_LABEL[ctx.sections.experiences]}
          action={
            <Button
              type="button"
              render={<Link href={PHASE_B1_M02_ROUTES.eventExperiences} />}
              data-testid="phase-b1-setup-event-experiences"
            >
              Set up your event experiences
            </Button>
          }
        />

        <MilestoneStepCard
          title="Your communications"
          description="Review your messages and choose how you'd like to stay in touch."
          statusLabel={SECTION_STATUS_LABEL[ctx.sections.communications]}
          action={
            <Button
              type="button"
              render={<Link href={PHASE_B1_M02_ROUTES.communications} />}
              data-testid="phase-b1-review-communications"
            >
              Review your communications
            </Button>
          }
        />
      </MilestoneDetailShell>
    </div>
  );
}
