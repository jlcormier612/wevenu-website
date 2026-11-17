import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OnboardingWorkspaceHeader } from "@/components/hq/onboarding-workspace-header";
import { SupportSection } from "@/components/hq/venue-detail/support-section";
import { OnboardingSendUpdate } from "@/components/hq/onboarding-send-update";
import { WhiteGloveOperatorPanel } from "@/components/hq/white-glove-operator-panel";
import { ImportWizard } from "@/components/settings/import-wizard";
import { MigrationCenter } from "@/components/settings/migration-center";
import { getSourceProfilesAction } from "@/app/(app)/settings/migration-actions";
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

  const [detail, { engagement, assignedName }, operatorView, sourceProfiles] = await Promise.all([
    getVenueHqDetail(venueId),
    getOnboardingEngagementWithName(venueId),
    getWhiteGloveOperatorView(venueId),
    getSourceProfilesAction(),
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
        accessEmailSentAt={operatorView.accessEmailSentAt}
        stages={operatorView.stages}
        materials={operatorView.materials}
        intakeSummary={operatorView.intakeSummary}
        validationIssues={operatorView.validationIssues}
      />

      <div id="wg-import-wizard" className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="font-heading text-sm font-semibold text-heading">
            Import data for {detail.venue.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The same Migration Center path the venue would use — every write lands in their
            venue. Prefer “Use in Import Wizard” on a received material so you do not re-upload
            the customer&apos;s file. Review staged rows before commit; a received file is not
            finished configuration.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Planning checklists: open Planning Templates for this venue after reviewing the
            uploaded guide — do not treat a planning PDF as an applied playbook until you
            confirm the template.
          </p>
        </div>
        <ImportWizard venueId={venueId} />
      </div>

      <div id="hq-planning-import" className="rounded-xl border border-border bg-card p-6" data-testid="hq-planning-import">
        <div className="mb-4">
          <h2 className="font-heading text-sm font-semibold text-heading">
            Planning materials for {detail.venue.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The same planning import the venue uses. Existing tasks, timelines, files, and selections stay on this venue and are not released or sent.
          </p>
        </div>
        <MigrationCenter
          sourceProfiles={sourceProfiles}
          cutover={{ readyForDatedEvents: true, spacesCount: 1, hasCapacityRules: true, message: null }}
          venueId={venueId}
          adminVenueId={venueId}
          initialSource="another_system"
          hideSourcePicker
          embedded
          initialEntityType="planning_material"
        />
      </div>

      <div id="hq-money-import" className="rounded-xl border border-border bg-card p-6" data-testid="hq-money-import">
        <div className="mb-4">
          <h2 className="font-heading text-sm font-semibold text-heading">
            Contracts and money for {detail.venue.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            The same Money import the venue uses. Historical agreements, invoices, and payments stay private and are not charged or sent.
          </p>
        </div>
        <MigrationCenter
          sourceProfiles={sourceProfiles}
          cutover={{ readyForDatedEvents: true, spacesCount: 1, hasCapacityRules: true, message: null }}
          venueId={venueId}
          adminVenueId={venueId}
          initialSource="another_system"
          hideSourcePicker
          embedded
          initialEntityType="active_commitment"
        />
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
