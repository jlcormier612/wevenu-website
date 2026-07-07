import type { Metadata } from "next";

import { BetaCommandCenter } from "@/components/hq/beta-command-center";
import { getBetaOverview } from "@/lib/hq/beta-service";

export const metadata: Metadata = { title: "Wevenu HQ" };

export default async function AdminHomePage() {
  const data = await getBetaOverview();

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
        <p className="text-2xl">📊</p>
        <p className="text-sm font-medium text-heading">No data yet</p>
        <p className="text-xs text-muted-foreground">The Beta Command Center will populate once venues start using Wevenu.</p>
      </div>
    );
  }

  return <BetaCommandCenter data={data} />;
}
