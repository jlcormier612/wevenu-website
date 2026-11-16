import type { Metadata } from "next";
import Link from "next/link";

import { markBookingProcessReviewedAction } from "@/app/(app)/setup-hub/actions";
import { ConfirmSectionButton } from "@/components/setup-hub/phase-b1/confirm-section-button";
import {
  GuidedBackToOverviewLink,
  GuidedSectionComplete,
  GuidedTaskCard,
} from "@/components/setup-hub/phase-b1/guided-task-card";
import { MilestoneDetailShell } from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Button } from "@/components/ui/button";
import { getQuickBooksConnection } from "@/lib/quickbooks/service";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import {
  hasUnpricedActivePackages,
  SECTION_STATUS_LABEL,
} from "@/lib/setup-hub/phase-b1-readiness";
import {
  quickBooksGuidedStatus,
  stripeGuidedStatus,
} from "@/lib/setup-hub/phase-b1-integration-status";
import { PHASE_B1_M02_ROUTES, withSetupHubReturn } from "@/lib/setup-hub/phase-b1-routes";

export const metadata: Metadata = { title: "Your booking process — Setup" };
export const dynamic = "force-dynamic";

export default async function BookingProcessSetupPage() {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;
  const unpriced = hasUnpricedActivePackages(ctx.packages);
  const packageStatus = unpriced
    ? "Needs attention"
    : ctx.packages.length > 0
      ? "In progress"
      : "Not set up";
  const contractStatus = ctx.contractStarterCount > 0 ? "In progress" : "Not set up";
  const stripeStatus = stripeGuidedStatus({
    onboardingStatus: ctx.venue.stripeOnboardingStatus,
    chargesEnabled: ctx.venue.stripeChargesEnabled,
  });
  const qb = await getQuickBooksConnection();
  const qbStatus = quickBooksGuidedStatus(qb?.status, qb?.lastHealthCheckOk);

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="02"
        title="Your booking process"
        intro="Prepare your offerings, contracts, and payment arrangements."
        statusLabel={SECTION_STATUS_LABEL[ctx.sections.booking]}
        backHref={PHASE_B1_M02_ROUTES.overview}
        backLabel="Back to Make HTC yours"
      >
        <GuidedTaskCard
          step="01"
          title="Packages and offerings"
          description="Choose what you offer, set your prices, and decide which packages you'd like to use."
          statusLabel={packageStatus}
          action={
            <Button type="button" render={<Link href={withSetupHubReturn("/packages", "booking-process")} />}>
              Review packages
            </Button>
          }
          note="HTC has prepared starter packages. Unpriced packages aren't ready to offer."
        />

        <GuidedTaskCard
          step="02"
          title="Contract templates"
          description="Review your agreement and make sure its terms reflect the way your venue operates."
          statusLabel={contractStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/library/contracts", "booking-process")} />}
            >
              Review contracts
            </Button>
          }
          note="A starter agreement is available. Review its terms before using it with clients."
        />

        <GuidedTaskCard
          step="03"
          title="Payment arrangements"
          description="Prepare how you'll collect deposits and payments from your clients."
          statusLabel="Not set up"
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/leads#booking", "booking-process")} />}
            >
              Review setup
            </Button>
          }
        />

        <GuidedTaskCard
          step="04"
          title="Online payment collection — Stripe Connect"
          description="Connect your Stripe account to accept deposits and invoice payments from clients."
          statusLabel={stripeStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/integrations#stripe", "booking-process")} />}
            >
              {stripeStatus === "Connected" || stripeStatus === "Needs attention"
                ? "Review setup"
                : "Connect Stripe"}
            </Button>
          }
          note="You'll securely connect or create your own Stripe account and complete any required business verification with Stripe."
        />

        <GuidedTaskCard
          step="05"
          title="QuickBooks Online"
          description="Connect your QuickBooks account to help keep your customers, invoices, payments, and refunds in sync."
          statusLabel={qbStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/integrations#quickbooks", "booking-process")} />}
            >
              {qbStatus === "Connected" || qbStatus === "Needs attention"
                ? "Review setup"
                : "Connect QuickBooks"}
            </Button>
          }
          note="You'll sign in to your own QuickBooks account and choose the company you want to connect."
        />

        <GuidedTaskCard
          step="06"
          title="Booking confirmation"
          description="Choose when an event becomes booked and how your calendar should respond."
          statusLabel="Not set up"
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/availability?focus=rules#rules", "booking-process")} />}
            >
              Review booking rules
            </Button>
          }
        />

        <GuidedSectionComplete
          heading="Ready to use your booking process?"
          description="Once you've reviewed your offerings, agreement, payment arrangements, and booking rules, confirm that your booking process is ready."
        >
          <ConfirmSectionButton
            action={markBookingProcessReviewedAction}
            label="Confirm your booking process"
            disabled={unpriced}
            disabledReason="Price or archive every active package before marking this ready. Unpriced starters are not ready to offer."
            testId="phase-b1-confirm-booking"
          />
        </GuidedSectionComplete>
        <GuidedBackToOverviewLink />
      </MilestoneDetailShell>
    </div>
  );
}
