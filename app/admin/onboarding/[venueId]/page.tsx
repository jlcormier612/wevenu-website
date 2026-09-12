import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OnboardingWorkspaceHeader } from "@/components/hq/onboarding-workspace-header";
import { SupportSection } from "@/components/hq/venue-detail/support-section";
import { OnboardingSendUpdate } from "@/components/hq/onboarding-send-update";
import { WhiteGloveOperatorPanel } from "@/components/hq/white-glove-operator-panel";
import { ImportWizard } from "@/components/settings/import-wizard";
import { requireAdminUser } from "@/lib/hq/crm-service";
import { getVenueHqDetail } from "@/lib/hq/venue-detail-service";
import { getOnboardingEngagementWithName, ensureOnboardingEngagement } from "@/lib/hq/onboarding-service";
import { getWhiteGloveOperatorView } from "@/lib/onboarding/white-glove-operator";

export const metadata: Metadata = { title: "Onboarding — Hello to Cheers HQ" };

type Props = { params: Promise<{ venueId: string }> };

export default async function OnboardingWorkspacePage({ params }: Props) {
  const { venueId } = await params;

  const actor = await requireAdminUser();
  if (!actor) redirect("/login");

  const [detail, { engagement, assignedName }, operatorView] = await Promise.all([
    getVenueHqDetail(venueId),
    getOnboardingEngagementWithName(venueId),
    getWhiteGloveOperatorView(venueId),
  ]);
  if (!detail) notFound();

  const resolvedEngagement = engagement ?? (await ensureOnboardingEngagement(venueId));

  return (
    <div className="space-y-6">
      <OnboardingWorkspaceHeader
        venueId={venueId}
        venueName={detail.venue.name}
        engagement={resolvedEngagement}
        assignedName={assignedName}
        currentAdminId={actor.userId}
        currentAdminName={actor.name}
      />

      <WhiteGloveOperatorPanel
        venueId={venueId}
        venueName={detail.venue.name}
        whiteGloveStatus={operatorView.whiteGloveStatus}
        stages={operatorView.stages}
        materials={operatorView.materials}
        intakeSummary={operatorView.intakeSummary}
        validationIssues={operatorView.validationIssues}
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="font-heading text-sm font-semibold text-heading">
            Import data for {detail.venue.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The same Migration Center path the venue would use — every write lands in their
            venue.
          </p>
        </div>
        <ImportWizard venueId={venueId} />
      </div>

      <SupportSection
        venueId={venueId}
        notes={detail.notes}
        tasks={detail.tasks}
        crmState={detail.crmState}
        engagementId={resolvedEngagement?.id ?? null}
      />

      <OnboardingSendUpdate venueId={venueId} venueEmail={detail.venue.email} />
    </div>
  );
}
