import type { Metadata } from "next";

import { QrCampaignsPageClient } from "@/components/qr-campaigns/qr-campaigns-page-client";
import { ensureQrStartersForCurrentVenue } from "@/lib/qr-campaigns/provision";
import { getQrCampaignAnalytics, getQrCampaigns } from "@/lib/qr-campaigns/service";
import { listPublishedPublicFormsForPicker } from "@/lib/public-forms/service";

export const metadata: Metadata = { title: "QR Campaigns" };

export default async function QrCampaignsPage() {
  await ensureQrStartersForCurrentVenue();
  const [campaigns, analytics, publishedPublicForms] = await Promise.all([
    getQrCampaigns(true),
    getQrCampaignAnalytics(),
    listPublishedPublicFormsForPicker(),
  ]);
  const existingMasterKeys = campaigns
    .map((c) => c.sourceMasterKey)
    .filter((k): k is string => Boolean(k));

  return (
    <QrCampaignsPageClient
      campaigns={campaigns}
      analytics={analytics}
      appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
      publishedPublicForms={publishedPublicForms}
      existingMasterKeys={existingMasterKeys}
    />
  );
}
