import Link from "next/link";

import { Greeting } from "@/components/dashboard/greeting";
import { MilestoneToast } from "@/components/dashboard/milestone-toast";
import { DashboardLuvIntro } from "@/components/dashboard/luv-intro";
import { Button } from "@/components/ui/button";
import { getDashboardHeaderData } from "@/lib/dashboard/service";
import {
  forensicExtra,
  forensicRecordL1,
  forensicTime,
  withDashboardForensic,
} from "@/lib/dashboard/forensic-timing";

/** Greeting + primary action — light path; does not await Focus briefing. */
export async function DashboardHeaderIsland() {
  return withDashboardForensic(async () => {
    const data = await forensicTime("get_dashboard_header_data", () => getDashboardHeaderData());
    if (!data) {
      forensicExtra("dashboard_header_data", "null");
      forensicRecordL1({
        source: "NONE",
        type: null,
        candidate: null,
        path: "dashboard_header_unavailable",
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
          setupHref={data.onboardingShow ? "/setup-hub" : "/setup-hub"}
        />
      </>
    );
  });
}
