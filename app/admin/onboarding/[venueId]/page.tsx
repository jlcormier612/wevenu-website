import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OnboardingWorkspaceHeader } from "@/components/hq/onboarding-workspace-header";
import { OverviewSection } from "@/components/hq/venue-detail/overview-section";
import { SupportSection } from "@/components/hq/venue-detail/support-section";
import { OnboardingSendUpdate } from "@/components/hq/onboarding-send-update";
import { ImportWizard } from "@/components/settings/import-wizard";
import { requireAdminUser } from "@/lib/hq/crm-service";
import { getVenueHqDetail } from "@/lib/hq/venue-detail-service";
import { getOnboardingEngagementWithName, ensureOnboardingEngagement } from "@/lib/hq/onboarding-service";

export const metadata: Metadata = { title: "Onboarding — Hello to Cheers HQ" };

type Props = { params: Promise<{ venueId: string }> };

export default async function OnboardingWorkspacePage({ params }: Props) {
  const { venueId } = await params;

  const actor = await requireAdminUser();
  if (!actor) redirect("/login");

  const [detail, { engagement, assignedName }] = await Promise.all([
    getVenueHqDetail(venueId),
    getOnboardingEngagementWithName(venueId),
  ]);
  if (!detail) notFound();

  // Opening the workspace starts the case file — a specialist shouldn't
  // have to take a separate "begin onboarding" action before this page is
  // fully usable (§2.2a: "get-or-create").
  const resolvedEngagement = engagement ?? await ensureOnboardingEngagement(venueId);

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

      {/* Guided Setup resumability — §1.2's real resumable-wizard-step
          system isn't built yet, so this reuses the Activation Engine's
          own gap data (already the source of truth every other Guided
          Setup surface reads from, per §1.1) rather than a blank slate. */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Setup progress, from the Activation Engine — not yet the step-by-step resumability §1.2 will add.</p>
        <OverviewSection activation={detail.activation} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h2 className="font-heading text-sm font-semibold text-heading">Import data for {detail.venue.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">The exact same Migration Center wizard the venue would run themselves — every write lands in their venue, not yours.</p>
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
