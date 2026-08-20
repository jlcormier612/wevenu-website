import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorLuvBriefing } from "@/components/vendor-app/vendor-luv-briefing";
import { VendorLuvIntro } from "@/components/vendor-app/vendor-luv-intro";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorLuvPageData } from "@/lib/vendor-luv/service";

export const metadata: Metadata = { title: "Luv — Vendor Portal" };

export default async function VendorLuvPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const { briefing, showIntro, greetingName } = await getVendorLuvPageData(vendorUser.vendorId);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-heading">Luv</h1>
        <p className="text-sm text-muted-foreground">
          What needs your attention today, {greetingName}.
        </p>
      </div>

      <VendorLuvIntro
        show={showIntro}
        ctaLabel="Review your open tasks"
        ctaHref="/vendor/events"
      />

      <VendorLuvBriefing briefing={briefing} isPrimarySurface />
    </div>
  );
}
