import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ReferAVenuePage } from "@/components/referrals/refer-a-venue-page";
import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { isReferralProgramReady } from "@shared/pricing";
import { getCurrentVenue } from "@/lib/venue/service";

// Path-filter anchor: keep required venue-app + hospitality checks on activation→Hub PRs.
export const metadata: Metadata = { title: "Refer a Venue — Settings" };

export default async function ReferralsSettingsPage() {
  // Hide promotional surface when the program flag is off — do not advertise
  // an unavailable benefit or show env diagnostics.
  if (!isReferralProgramReady()) {
    redirect("/settings");
  }

  const venue = await getCurrentVenue();
  if (!venue) return null;

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Refer a Venue"
          description="Introduce another venue to Hello to Cheers and enjoy a little thank-you from us."
        />
      </div>
      <SettingsTabs />
      <ReferAVenuePage />
    </div>
  );
}
