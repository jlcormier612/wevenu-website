import type { Metadata } from "next";
import Link from "next/link";

import { startOrResumePracticeRunAction } from "@/app/(app)/setup-hub/practice-run/actions";
import { Milestone04ReadinessAction } from "@/components/setup-hub/phase-a/milestone-04-readiness-action";
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
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";

export const metadata: Metadata = { title: "Take a look, then go live — Setup" };
export const dynamic = "force-dynamic";

export default async function TakeALookPage({
  searchParams,
}: {
  searchParams: Promise<{ practiceError?: string; practiceFinished?: string }>;
}) {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;

  const params = await searchParams;
  const practiceError = params.practiceError?.trim() || null;
  const practiceFinished = params.practiceFinished === "1";

  const [spaces, importBatches, activePractice] = await Promise.all([
    getSpaces(),
    getImportBatches(),
    getActivePracticeRunForCurrentVenue(),
  ]);
  const { hasImportedActivity, hasMigrationImport } = phaseAImportFlags(importBatches);
  const milestones = buildPhaseAMilestones({
    hubState: ctx.hubState,
    spacesCount: spaces.length,
    hasMigrationImport,
    hasImportedActivity,
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

  const hasPracticeRun = Boolean(activePractice?.sampleEventId);
  const readyToGoLive = ctx.hubState?.readyToInviteCouples === true;
  const incompleteRecommended = milestones
    .slice(0, 3)
    .filter((m) => m.status !== "ready")
    .map((m) => ({
      number: m.number,
      title: m.title,
      statusLabel: m.statusLabel,
    }));

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
              : "Optional — start a sample wedding that uses your venue branding and the real Hello to Cheers tools, safely isolated from your live business. Never required to go live."
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
          description="Check your calendar, business setup, client experience, and communications — or come back to unfinished work anytime."
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
              ? "You've said you're ready to work with clients. Open your Dashboard to keep going — turn on forms, automations, and payments when you're comfortable. Setup Hub stays available."
              : "When you're ready to begin working with clients, say so below. Recommended setup is guided, not required. Practice Run is optional and never blocks going live."
          }
          action={
            <div className="space-y-4">
              <Milestone04ReadinessAction
                readyToInviteCouples={readyToGoLive}
                readyToInviteCouplesAt={ctx.hubState?.readyToInviteCouplesAt ?? null}
                incompleteRecommended={incompleteRecommended}
              />
              {readyToGoLive ? (
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
                    Declare readiness above when you&apos;re ready. Nothing goes live until you
                    choose it.
                  </p>
                </div>
              )}
            </div>
          }
        />
      </MilestoneDetailShell>
    </div>
  );
}
