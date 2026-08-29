import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { QrCampaignList } from "@/components/qr-campaigns/qr-campaign-list";
import { QrStarterExamples } from "@/components/qr-campaigns/qr-starter-examples";
import { getQrCampaignAnalytics, getQrCampaigns } from "@/lib/qr-campaigns/service";

export const metadata: Metadata = { title: "QR Campaigns" };

export default async function QrCampaignsPage() {
  const [campaigns, analytics] = await Promise.all([
    getQrCampaigns(true),
    getQrCampaignAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Campaigns"
        description="Generate a QR code for a bridal show, brochure, or front-gate sign — every scan can become a lead automatically."
      />
      <QrStarterExamples hasCampaigns={campaigns.some((c) => c.status === "active")} />
      <QrCampaignList
        initialCampaigns={campaigns}
        analytics={analytics}
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
      />
    </div>
  );
}
