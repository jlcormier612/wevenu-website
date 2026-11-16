import type { Metadata } from "next";

import { OperationalResourcesForm } from "@/components/setup-hub/phase-b1/operational-resources-form";
import { MilestoneDetailShell } from "@/components/setup-hub/phase-a/milestone-detail-shell";
import { loadMilestone02Context } from "@/lib/setup-hub/phase-b1-load";
import { SECTION_STATUS_LABEL } from "@/lib/setup-hub/phase-b1-readiness";
import { PHASE_B1_M02_ROUTES } from "@/lib/setup-hub/phase-b1-routes";

export const metadata: Metadata = { title: "Your operational resources — Setup" };
export const dynamic = "force-dynamic";

export default async function OperationalResourcesSetupPage() {
  const ctx = await loadMilestone02Context();
  if (!ctx) return null;
  const choices = ctx.hubState?.operationalResourceChoices ?? {};
  const starter = ctx.operationalStarterAvailable;

  return (
    <div className="htc-hospitality-page">
      <MilestoneDetailShell
        number="02"
        title="Your operational resources"
        intro="Explore the planning tools and prepare what works for your venue."
        statusLabel={SECTION_STATUS_LABEL[ctx.sections.operations]}
        backHref={PHASE_B1_M02_ROUTES.overview}
        backLabel="Back to Make HTC yours"
      >
        <p className="text-sm text-muted-foreground">
          HTC has prepared planning resources to help you get started. Choose what you&apos;ll use and
          leave the rest for later.
        </p>

        <OperationalResourcesForm
          initialChoices={choices}
          starterKeys={{
            playbooks: starter,
            timelines: starter,
            questionnaires: starter,
            event_orders: starter,
            inventory: starter,
            floor_plans: starter,
            client_guide: starter,
            documents: false,
          }}
        />
      </MilestoneDetailShell>
    </div>
  );
}
