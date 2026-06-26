import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { VenueSettings } from "@/components/settings/venue-settings";
import { getVenueSettings } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Settings" };

/**
 * Venue Settings — every field entered during setup is editable here.
 * Loads current venue data server-side and passes it to the VenueSettings
 * client component, which reuses the wizard step components directly.
 * Route is protected by the (app) layout (venue existence already confirmed).
 */
export default async function SettingsPage() {
  const settings = await getVenueSettings();

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Venue configuration and preferences."
        />
        <p className="text-sm text-muted-foreground">
          Your venue settings could not be loaded. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Edit your venue information, hours, brand, and preferences."
      />
      <VenueSettings initial={settings.input} />
    </div>
  );
}
