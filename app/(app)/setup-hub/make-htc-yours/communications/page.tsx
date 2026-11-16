import type { Metadata } from "next";
import Link from "next/link";

import { markCommunicationsReviewedAction } from "@/app/(app)/setup-hub/actions";
import { ConfirmSectionButton } from "@/components/setup-hub/phase-b1/confirm-section-button";
import {
  GuidedBackToOverviewLink,
  GuidedSectionComplete,
  GuidedTaskCard,
} from "@/components/setup-hub/phase-b1/guided-task-card";
import { MilestoneDetailShell } from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { getFacebookConnection, getFacebookLeadForms } from "@/lib/facebook/service";
import { facebookUiState } from "@/lib/facebook/ui-state";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import {
  facebookGuidedStatus,
  textingGuidedStatus,
  tourSchedulingGuidedStatus,
} from "@/lib/setup-hub/phase-b1-integration-status";
import { SECTION_STATUS_LABEL } from "@/lib/setup-hub/phase-b1-readiness";
import { PHASE_B1_M02_ROUTES, withSetupHubReturn } from "@/lib/setup-hub/phase-b1-routes";
import { getTextingSetupBundle } from "@/lib/texting-registration/service";
import { getTourSettings } from "@/lib/tours/service";

export const metadata: Metadata = { title: "Your communications — Setup" };
export const dynamic = "force-dynamic";

export default async function CommunicationsSetupPage() {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;
  const templateStatus = ctx.messageTemplateCount > 0 ? "Starter ready for you" : "Not set up";
  const automationStatus =
    ctx.activeAutomationCount > 0
      ? "In progress"
      : ctx.pausedAutomationCount > 0
        ? "Starter ready for you"
        : "Not set up";
  async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }
  const [texting, facebookConnection, facebookForms, tourSettings] = await Promise.all([
    safe(() => getTextingSetupBundle(), null),
    safe(() => getFacebookConnection(), null),
    safe(() => getFacebookLeadForms(), []),
    safe(() => getTourSettings(), null),
  ]);
  const smsStatus = textingGuidedStatus({
    smsReady: texting?.statusPanel.smsReady ?? false,
    phase: texting?.statusPanel.phase ?? texting?.phase ?? null,
  });
  const facebookStatus = facebookGuidedStatus(facebookUiState(facebookConnection, facebookForms));
  const tourStatus = tourSchedulingGuidedStatus(tourSettings?.tourSchedulingEnabled ?? false);

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="02"
        title="Your communications"
        intro="Review your messages and choose how you'd like to stay in touch."
        statusLabel={SECTION_STATUS_LABEL[ctx.sections.communications]}
        backHref={PHASE_B1_M02_ROUTES.overview}
        backLabel="Back to Make HTC yours"
      >
        <p className="text-sm text-muted-foreground">
          HTC has prepared messages and automations for you. Nothing will be sent automatically until
          you choose to turn it on.
        </p>

        <GuidedTaskCard
          step="01"
          title="Email and message templates"
          description="Prepare reusable emails and text messages for inquiries, bookings, and planning."
          statusLabel={templateStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/communication/templates", "communications")} />}
            >
              Review message templates
            </Button>
          }
        />

        <GuidedTaskCard
          step="02"
          title="Automations"
          description="Choose which follow-ups and reminders you'd like HTC to handle."
          statusLabel={automationStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/communication/series", "communications")} />}
            >
              Review automations
            </Button>
          }
          note="Automations start paused. You decide when to turn them on."
        >
          <p className="text-xs text-muted-foreground">
            {ctx.pausedAutomationCount} paused · {ctx.activeAutomationCount} on
          </p>
        </GuidedTaskCard>

        <GuidedTaskCard
          step="03"
          title="Email setup"
          description="Review the email details your clients will see when you communicate with them."
          statusLabel="Not set up"
          action={
            <Button
              type="button"
              render={
                <Link href={withSetupHubReturn("/settings/communications#identity", "communications")} />
              }
            >
              Review email settings
            </Button>
          }
        />

        <GuidedTaskCard
          step="04"
          title="Text messaging setup"
          description="Set up text messaging so your team can communicate with leads and clients. You'll complete the required business registration and consent settings before sending texts."
          statusLabel={smsStatus}
          statusTestId="phase-b1-texting-status"
          action={
            <Link
              href={withSetupHubReturn("/settings/communications#texting", "communications")}
              className={buttonVariants()}
              data-testid="phase-b1-texting-setup"
            >
              Set up text messaging
            </Link>
          }
        />

        <GuidedTaskCard
          step="05"
          title="Public inquiry form and lead capture"
          description="Choose what prospective clients can inquire about, customize your inquiry form, and decide how new leads enter your workspace."
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/leads#inquiry", "communications")} />}
            >
              Set up lead capture
            </Button>
          }
        />

        <GuidedTaskCard
          step="06"
          title="Tour scheduling"
          description="Choose whether visitors can schedule a tour and how those appointments are offered."
          statusLabel={tourStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/leads#tours", "communications")} />}
            >
              Review setup
            </Button>
          }
        />

        <GuidedTaskCard
          step="07"
          title="Facebook / Instagram Lead Ads"
          description="Connect your Facebook Page and Lead Ads forms to bring new inquiries into Hello to Cheers automatically."
          statusLabel={facebookStatus}
          action={
            <Button
              type="button"
              render={<Link href={withSetupHubReturn("/settings/integrations#facebook", "communications")} />}
            >
              {facebookStatus === "Connected" || facebookStatus === "Needs attention"
                ? "Review setup"
                : "Connect Facebook"}
            </Button>
          }
          note="You'll sign in to your own account and choose which Page and forms to connect."
        />

        <GuidedSectionComplete
          heading="Happy with your communication setup?"
          description="You can finish this step with automations paused and text messaging turned off."
        >
          <ConfirmSectionButton
            action={markCommunicationsReviewedAction}
            label="Confirm your communications"
            testId="phase-b1-confirm-communications"
          />
        </GuidedSectionComplete>
        <GuidedBackToOverviewLink />
      </MilestoneDetailShell>
    </div>
  );
}
