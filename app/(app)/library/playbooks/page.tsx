import type { Metadata } from "next";

import { PlanningStarterExamples } from "@/components/playbooks/planning-starter-examples";
import { PageHeader } from "@/components/shell/module-placeholder";
import { PlanningCapabilitiesSection } from "@/components/settings/planning-capabilities-section";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getEvents } from "@/lib/events/service";
import { getTemplatesForLibrary } from "@/lib/playbooks/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = { title: "Planning Templates" };

export default async function PlaybooksLibraryPage() {
  const [templates, events, venue] = await Promise.all([
    getTemplatesForLibrary(),
    getEvents(),
    getCurrentVenue(),
  ]);
  const planningCapabilities = {
    timeline: venue?.planningTimelineEnabled ?? true,
    floorPlan: venue?.planningFloorPlanEnabled ?? true,
    seating: venue?.planningSeatingEnabled ?? true,
    vendors: venue?.planningVendorsEnabled ?? true,
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning Templates"
        description="Reusable checklists you refine once, then apply to each event. Preview any template to see what's inside — applying always creates that event's own editable copy."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planning capabilities</CardTitle>
          <CardDescription>
            Tell Hello to Cheers which planning surfaces your venue actually uses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlanningCapabilitiesSection initial={planningCapabilities} />
        </CardContent>
      </Card>
      <PlanningStarterExamples templates={templates} />
      <PlaybooksSection
        initialTemplates={templates}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
      />
    </div>
  );
}
