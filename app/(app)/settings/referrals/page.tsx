import type { Metadata } from "next";

import { ReferAVenuePage } from "@/components/referrals/refer-a-venue-page";
import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Refer a Venue — Settings" };

export default async function ReferralsSettingsPage() {
  const venue = await getCurrentVenue();
  if (!venue) return null;

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Refer a Venue"
          description="Share the Luv with another venue and earn a free month of Hello to Cheers when they become a qualifying paying customer."
        />
      </div>
      <SettingsTabs />
      <ReferAVenuePage />
    </div>
  );
}
