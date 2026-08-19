import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { VenueSettings } from "@/components/settings/venue-settings";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Business & Brand — Settings" };

/**
 * Settings > Business & Brand. Renders the existing VenueSettings
 * component whole — it's exported as a single component internally
 * covering owner info/currency/week-start, venue story, review link,
 * brand colors, logo, and hero photo (see components/settings/venue-
 * settings.tsx), plus venue name/profile/hours fields not explicitly
 * named in the category spec. Splitting it further would mean editing
 * components/setup/setup-steps.tsx, which is shared with the setup
 * wizard — avoided per "don't rewrite business logic."
 */
export default async function BusinessBrandSettingsPage() {
  const [settings, venue] = await Promise.all([getVenueSettings(), getCurrentVenue()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business & Brand"
        description="Your venue information, appearance, and public-facing details."
      />
      <SettingsTabs />
      {settings ? (
        <VenueSettings initial={settings.input} venueId={settings.venueId} publicReviewUrl={venue?.publicReviewUrl ?? ""} />
      ) : (
        <p className="text-sm text-muted-foreground">Your venue settings could not be loaded. Please refresh the page.</p>
      )}
    </div>
  );
}
