import Link from "next/link";

import { Greeting } from "@/components/dashboard/greeting";
import { MilestoneToast } from "@/components/dashboard/milestone-toast";
import { DashboardLuvIntro } from "@/components/dashboard/luv-intro";
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard/service";
import {
  forensicExtra,
  forensicRecordL1,
  forensicTime,
  withDashboardForensic,
} from "@/lib/dashboard/forensic-timing";

/** Greeting + primary action. Shares request-scoped getDashboardData(). */
export async function DashboardHeaderIsland() {
  return withDashboardForensic(async () => {
    const data = await forensicTime("get_dashboard_data", () => getDashboardData());
    if (!data) {
      forensicExtra("dashboard_data", "null");
      forensicRecordL1({
        source: "NONE",
        type: null,
        candidate: null,
        path: "dashboard_unavailable",
      });
      return (
        <div className="htc-hospitality-heading htc-hospitality-intro-accent">
          <p className="text-sm text-muted-foreground">Dashboard unavailable.</p>
        </div>
      );
    }

    return (
      <>
        <MilestoneToast milestone={data.nextPendingMilestone} />
        <div className="htc-hospitality-heading htc-hospitality-intro-accent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Greeting venueName={data.venueName} ownerFirstName={data.ownerFirstName} />
            <Button render={<Link href="/leads/new" />} className="w-full sm:w-auto sm:shrink-0">
              + New Lead
            </Button>
          </div>
        </div>
        <DashboardLuvIntro
          show={data.showLuvIntro}
          setupHref={data.onboarding.show ? "/setup-hub" : "/setup-hub"}
        />
      </>
    );
  });
}
