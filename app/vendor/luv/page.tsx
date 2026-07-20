import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorLuvBriefing } from "@/components/vendor-app/vendor-luv-briefing";
import { VendorHealthScoreWidget } from "@/components/vendor-app/vendor-health-score-widget";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorDashboardData } from "@/lib/vendor-profile/service";
import { getVendorObservations } from "@/lib/luv/vendor-observations";

export const metadata: Metadata = { title: "Luv — Vendor Portal" };

export default async function VendorLuvPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const data = await getVendorDashboardData(vendorUser.vendorId);
  const { wins, observations } = data ? getVendorObservations(data) : { wins: [], observations: [] };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Luv</h1>
        <p className="text-sm text-muted-foreground">Your built-in business assistant.</p>
      </div>

      <VendorLuvBriefing
        wins={wins}
        observations={observations}
        healthTip={data?.healthScore?.luvTip}
        isPrimarySurface
      />

      {data?.healthScore && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Business Health</h2>
          <VendorHealthScoreWidget health={data.healthScore} />
        </div>
      )}
    </div>
  );
}
