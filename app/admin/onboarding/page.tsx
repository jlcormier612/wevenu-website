import type { Metadata } from "next";

import { OnboardingTable } from "@/components/hq/onboarding-table";
import { getOnboardingDashboard } from "@/lib/hq/onboarding-service";

export const metadata: Metadata = { title: "Customer Success — Hello to Cheers HQ" };

export default async function OnboardingDashboardPage() {
  const engagements = await getOnboardingDashboard();
  const openCount = engagements.filter((e) => e.status !== "complete").length;
  const blockedCount = engagements.filter((e) => e.status === "blocked").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-heading">Customer Success</h1>
        <p className="text-sm text-muted-foreground">
          {openCount} venue{openCount === 1 ? "" : "s"} in active onboarding
          {blockedCount > 0 && <span className="text-destructive"> · {blockedCount} blocked</span>}
        </p>
      </div>
      <OnboardingTable engagements={engagements} />
    </div>
  );
}
