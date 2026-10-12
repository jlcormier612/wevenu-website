import type { Metadata } from "next";

import { BetaCommandCenter } from "@/components/hq/beta-command-center";
import { OpsAlertsBanner } from "@/components/hq/ops-alerts-panel";
import { getBetaOverview } from "@/lib/hq/beta-service";
import { countActiveOpsIncidents } from "@/lib/hq/ops-incidents";

export const metadata: Metadata = { title: "Hello to Cheers HQ" };

export default async function AdminHomePage() {
  const [data, activeOps] = await Promise.all([
    getBetaOverview(),
    countActiveOpsIncidents().catch(() => 0),
  ]);

  if (!data) {
    return (
      <div className="space-y-4">
        <OpsAlertsBanner count={activeOps} />
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
          <p className="text-2xl">📊</p>
          <p className="text-sm font-medium text-heading">No data yet</p>
          <p className="text-xs text-muted-foreground">The Beta Command Center will populate once venues start using Hello to Cheers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OpsAlertsBanner count={activeOps} />
      <BetaCommandCenter data={data} />
    </div>
  );
}
