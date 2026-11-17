import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PracticeConversationPanel } from "@/components/setup-hub/practice-conversation-panel";
import { PracticeRunJourney } from "@/components/setup-hub/practice-run-journey";
import { PracticeRunLifecyclePanel } from "@/components/setup-hub/practice-run-lifecycle";
import { PracticeRunShell } from "@/components/setup-hub/practice-run-shell";
import { getTemplatesMetadata } from "@/lib/contracts/service";
import { getPackages } from "@/lib/packages/service";
import { loadPracticeConversationMessages } from "@/lib/practice-run/conversation-service";
import {
  getActivePracticeRunForCurrentVenue,
  getPracticeRunForCurrentVenue,
} from "@/lib/practice-run/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Practice Run — Setup" };
export const dynamic = "force-dynamic";

export default async function PracticeRunPage({
  searchParams,
}: {
  searchParams: Promise<{
    run?: string;
    practiceReset?: string;
    practiceFinished?: string;
    lifecycleError?: string;
  }>;
}) {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  const params = await searchParams;
  const requestedId = params.run?.trim() || null;
  const run = requestedId
    ? await getPracticeRunForCurrentVenue(requestedId)
    : await getActivePracticeRunForCurrentVenue();

  if (!run) {
    redirect("/setup-hub/take-a-look");
  }

  const [packages, templates, conversationMessages] = await Promise.all([
    getPackages(true).catch(() => []),
    getTemplatesMetadata(false).catch(() => []),
    loadPracticeConversationMessages(run).catch(() => []),
  ]);

  const justReset = params.practiceReset === "1";
  const lifecycleError = params.lifecycleError?.trim() || null;

  return (
    <PracticeRunShell run={run} venueName={venue.name} perspective="venue">
      {justReset ? (
        <p
          className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground"
          data-testid="practice-reset-success"
          role="status"
        >
          Fresh start — Maya &amp; Jordan are ready again. Your real venue settings were not changed.
        </p>
      ) : null}
      {lifecycleError ? (
        <p
          className="rounded-lg border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground"
          data-testid="practice-lifecycle-error"
          role="alert"
        >
          {lifecycleError}
        </p>
      ) : null}
      <PracticeRunJourney
        run={run}
        venuePackages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          basePrice: p.basePrice,
        }))}
        venueContractTemplates={templates.map((t) => ({
          id: t.id,
          name: t.name,
        }))}
      />
      <PracticeConversationPanel run={run} messages={conversationMessages} />
      <PracticeRunLifecyclePanel run={run} />
    </PracticeRunShell>
  );
}
