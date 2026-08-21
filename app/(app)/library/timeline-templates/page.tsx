import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { TimelineTemplatesSection } from "@/components/timeline-templates/timeline-templates-section";
import { getSpaces } from "@/lib/availability/service";
import { getEvents } from "@/lib/events/service";
import { ensureTimelineStartersForCurrentVenue } from "@/lib/timeline-templates/provision";
import { TIMELINE_STARTER_MASTERS } from "@/lib/timeline-templates/starters";
import { getTemplatesForLibrary } from "@/lib/timeline-templates/service";

export const metadata: Metadata = { title: "Timeline Templates" };

export default async function TimelineTemplatesPage() {
  await ensureTimelineStartersForCurrentVenue();
  const [templates, spaces, events] = await Promise.all([getTemplatesForLibrary(), getSpaces(), getEvents()]);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = TIMELINE_STARTER_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timeline Templates"
        description="Reusable day-of schedules a venue builds once and applies to any booking."
      />
      <TimelineTemplatesSection
        initialTemplates={templates}
        spaces={spaces}
        missingStarterKeys={missingStarterKeys}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate, startTime: e.startTime }))}
      />
    </div>
  );
}
