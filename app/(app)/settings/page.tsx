import type { Metadata } from "next";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { StripeConnectSection } from "@/components/settings/stripe-connect-section";
import { VenueSettings } from "@/components/settings/venue-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCapacityRules, getSpaces } from "@/lib/availability/service";
import { getCurrentVenue, getVenueSettings } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Settings" };

/**
 * Venue Settings — every field entered during setup is editable here.
 * Loads current venue data server-side and passes it to the VenueSettings
 * client component, which reuses the wizard step components directly.
 * Route is protected by the (app) layout (venue existence already confirmed).
 */
export default async function SettingsPage() {
  const [settings, venue, spaces, capacityRules] = await Promise.all([
    getVenueSettings(), getCurrentVenue(), getSpaces(), getCapacityRules(),
  ]);

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
      <VenueSettings initial={settings.input} venueId={settings.venueId} />
      {venue && <StripeConnectSection venue={venue} />}

      {/* ── Availability & Spaces ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event Spaces</CardTitle>
          <CardDescription>
            Define the named spaces within your venue (Ballroom, Garden, Barn…).
            Each space can have its own capacity and be assigned to events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VenueSpacesSection initialSpaces={spaces} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduling Capacity</CardTitle>
          <CardDescription>
            Configure your venue{"'"}s operating limits. The system will warn when
            these thresholds are approached.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CapacityRulesSection initialRules={capacityRules} />
        </CardContent>
      </Card>
    </div>
  );
}
