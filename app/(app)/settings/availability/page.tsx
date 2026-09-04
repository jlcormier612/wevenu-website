import type { Metadata } from "next";

import { CapacityRulesSection } from "@/components/availability/capacity-rules-section";
import { VenueSpacesSection } from "@/components/availability/venue-spaces-section";
import { SetupGuideLink } from "@/components/help/setup-guide-link";
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

      <Card id="tour-availability" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Weekly Availability &amp; Blocked Dates</CardTitle>
          <CardDescription>
            When tours can be booked, and any dates you need to block off. This is Tour Availability —
            separate from your general Business Hours in Settings → Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <TourAvailabilityEditor
            initialWindows={windows}
            initialExceptions={exceptions}
            loadError={loadError}
          />
          <SetupGuideLink href="/help/setup-calendar-availability#tour-availability" label="Deciding whether to offer online tours" />
        </CardContent>
      </Card>

      <Card id="capacity" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Scheduling Capacity</CardTitle>
          <CardDescription>
            Event and tour simultaneous limits and event turnaround are enforced when booking. A missing simultaneous setting is treated as 1 — never unlimited. Turnaround of 0 means events may be back-to-back.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CapacityRulesSection initialRules={capacityRules} />
          <SetupGuideLink href="/help/setup-calendar-availability#capacity" label="How capacity affects booking" />
        </CardContent>
      </Card>

      <Card id="spaces" className="scroll-mt-20">
        <CardHeader>
          <CardTitle className="text-base">Event Spaces</CardTitle>
          <CardDescription>
            Define the named spaces within your venue (Ballroom, Garden, Barn…).
            Each space can have its own capacity and be assigned to events. If you have more than one
            space, add them here before bringing over dated events in Bring Your Business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <VenueSpacesSection initialSpaces={spaces} />
          <SetupGuideLink href="/help/setup-calendar-availability#spaces" label="Why spaces matter" />
        </CardContent>
      </Card>
    </div>
  );
}
