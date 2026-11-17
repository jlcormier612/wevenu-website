import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PracticeClientFrame } from "@/components/setup-hub/practice-client-frame";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePracticeClientAccess } from "@/lib/practice-run/client-perspective";
import {
  resolvePortalContext,
  resolvePortalTasks,
  resolvePortalTimeline,
  resolvePortalVendorTasks,
} from "@/lib/portal/service";

type Props = {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<{ view?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { runId } = await params;
  const access = await requirePracticeClientAccess(runId);
  if (!access.ok) return { title: "Practice Run" };
  return {
    title: { absolute: `${access.run.celebrationName} — Client view` },
    description: `Practice Run client experience for ${access.venueName}`,
  };
}

export default async function PracticeRunClientPage({ params, searchParams }: Props) {
  const { runId } = await params;
  const access = await requirePracticeClientAccess(runId);
  if (!access.ok) {
    if (access.status === 404) notFound();
    notFound();
  }

  const token = access.portalToken;
  const context = await resolvePortalContext(token);
  if (!context) notFound();

  const query = searchParams ? await searchParams : {};
  const viewParam = Array.isArray(query.view) ? query.view[0] : query.view;
  const initialSection =
    viewParam === "messages"
      ? "messages"
      : viewParam === "documents"
        ? "documents"
        : viewParam === "questionnaire"
          ? "questionnaire"
          : viewParam === "timeline"
            ? "timeline"
            : undefined;

  const [tasks, vendorTasks, timeline] = await Promise.all([
    resolvePortalTasks(token),
    resolvePortalVendorTasks(token),
    resolvePortalTimeline(token),
  ]);

  // Practice Run skips the couple legal gate — staff is exploring a sample, not a real couple account.
  const legalGate = { needsAcceptance: false, documents: [] as never[] };

  return (
    <PracticeClientFrame run={access.run} venueName={access.venueName}>
      <div className="h-full overflow-hidden" data-testid="practice-client-portal">
        <PortalShell
          token={token}
          context={context}
          initialSection={initialSection}
          initialTasks={tasks}
          initialVendorTasks={vendorTasks}
          initialTimelineSections={timeline.sections}
          initialTimelineEntries={timeline.entries}
          initialTimelineLastSubmittedAt={timeline.lastSubmittedAt}
          initialTimelineHasUnpublishedChanges={timeline.hasUnpublishedChanges}
          initialLegalGate={legalGate}
          skipLegalGate
        />
      </div>
    </PracticeClientFrame>
  );
}
