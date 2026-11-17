import type { Metadata } from "next";
import Link from "next/link";

import { startOrResumePracticeRunAction } from "@/app/(app)/setup-hub/practice-run/actions";
import {
  MilestoneDetailShell,
  MilestoneGuidancePanel,
  MilestoneStepCard,
} from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { Button } from "@/components/ui/button";
import { getSpaces } from "@/lib/availability/service";
import { phaseAImportFlags } from "@/lib/import/activity";
import { getImportBatches } from "@/lib/import/batches";
import { getActivePracticeRunForCurrentVenue } from "@/lib/practice-run/service";
import { buildPhaseAMilestones } from "@/lib/setup-hub/phase-a-milestones";
import { getSetupHubState } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Take a look, then go live — Setup" };
export const dynamic = "force-dynamic";

export default async function TakeALookPage({
  searchParams,
}: {
  searchParams: Promise<{ practiceError?: string; practiceFinished?: string }>;
}) {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const params = await searchParams;
  const practiceError = params.practiceError?.trim() || null;
  const practiceFinished = params.practiceFinished === "1";

  const [hubState, spaces, importBatches, activePractice] = await Promise.all([
    getSetupHubState(),
    getSpaces(),
    getImportBatches(),
    getActivePracticeRunForCurrentVenue(),
  ]);
  const { hasImportedActivity, hasMigrationImport } = phaseAImportFlags(importBatches);
  const milestones = buildPhaseAMilestones({
    hubState,
    spacesCount: spaces.length,
    hasMigrationImport,
    hasImportedActivity,
    venueBrandStarted: false,
    setupProfileCount: 0,
  });

  const hasPracticeRun = Boolean(activePractice?.sampleEventId);
  const readyToGoLive = hubState?.readyToInviteCouples === true;

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="04"
        title="Take a look, then go live"
        intro="Everything is coming together! Before you invite your clients, take HTC for a spin with a sample celebration."
        statusLabel={milestones[3]?.statusLabel}
      >
        <MilestoneGuidancePanel title="See Hello to Cheers in action.">
          Take HTC for a spin with a sample celebration. Explore the venue experience, step into
          your client&apos;s shoes, and see how everything works together — without sending
          messages, collecting payments, or changing your real business.
        </MilestoneGuidancePanel>

        {practiceError ? (
          <p
            className="rounded-lg border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground"
            data-testid="practice-run-error"
            role="alert"
          >
            {practiceError}
          </p>
        ) : null}

        {practiceFinished ? (
          <p
            className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
            data-testid="practice-finished-banner"
            role="status"
          >
            Beautiful — you&apos;ve seen how Hello to Cheers feels for your couples. Continue Practice
            Run anytime, or keep setting up when you&apos;re ready. Going live is still your choice.
          </p>
        ) : null}

        <MilestoneStepCard
          title="Practice Run"
          description={
            hasPracticeRun
              ? `Continue with ${activePractice?.celebrationName ?? "your sample celebration"}. Nothing here is sent or added to your live business.`
              : "Start a sample wedding that uses your venue branding and the real Hello to Cheers tools — safely isolated from your live business."
          }
          action={
            <form action={startOrResumePracticeRunAction}>
              <Button type="submit" data-testid="practice-run-primary-cta">
                {hasPracticeRun ? "Continue Practice Run" : "Start Practice Run"}
              </Button>
            </form>
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
          description={
            readyToGoLive
              ? "You've said you're ready to invite couples. Open your Dashboard to keep going — turn on forms, automations, and payments when you're comfortable."
              : "When your calendar, brand, and client experience feel right, declare readiness from Setup Hub. Practice Run is optional and never blocks going live."
          }
          action={
            readyToGoLive ? (
              <Button
                type="button"
                render={<Link href="/dashboard" data-testid="phase-a-finish-enabled" />}
              >
                Finish setup &amp; go to Dashboard
              </Button>
            ) : (
              <div className="space-y-2">
                <Button type="button" disabled data-testid="phase-a-finish-disabled">
                  Finish setup &amp; go to Dashboard
                </Button>
                <p className="text-xs text-muted-foreground" data-testid="phase-a-finish-hint">
                  Still setting up? Open Setup Hub to review readiness. Nothing goes live until you
                  choose it.
                </p>
              </div>
            )
          }
        />
      </MilestoneDetailShell>
    </div>
  );
}
