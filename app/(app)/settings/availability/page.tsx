import type { Metadata } from "next";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { TourAvailabilityEditor } from "@/components/settings/tour-availability-editor";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCapacityRules, getSpaces } from "@/lib/availability/service";
import { editorHydrationFromAvailability } from "@/lib/tours/availability-read";
import { getTourAvailability } from "@/lib/tours/service";

export const metadata: Metadata = { title: "Availability & Capacity — Settings" };

export default async function AvailabilityCapacitySettingsPage() {
  const [spaces, capacityRules, tourAvailability] = await Promise.all([
    getSpaces(), getCapacityRules(), getTourAvailability(),
  ]);
  const { windows, exceptions, loadError } = editorHydrationFromAvailability(tourAvailability);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability & Capacity"
        description="Tour hours, blocked dates, spaces, and operating limits."
      />
      <SettingsTabs />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Availability &amp; Blocked Dates</CardTitle>
          <CardDescription>
            When tours can be booked, and any dates you need to block off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TourAvailabilityEditor
            initialWindows={windows}
            initialExceptions={exceptions}
            loadError={loadError}
          />
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
    </div>
  );
}
