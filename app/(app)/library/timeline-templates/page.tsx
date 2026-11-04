import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { TimelineTemplateStarterPicker } from "@/components/timeline-templates/timeline-template-starter-picker";
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
  const activeTemplates = templates.filter((t) => !t.isArchived);

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Timeline Templates"
          description="Reusable day-of schedules you build once and apply to any booking."
          actions={
            <TimelineTemplateStarterPicker existingTemplates={activeTemplates} spaces={spaces} />
          }
        />
      </div>
      <LibraryDependencyNote
        tone="calm"
        detail={
          <>
            Schedule blocks (times and labels) are authored in the timeline editor; optionally assign
            a template to a space. Customize a starter to create your venue&apos;s own copy — editing
            yours never changes the starter. Apply from the event Timeline or Setup; Library templates
            are never emailed to clients.
          </>
        }
        action={{ href: "/settings/availability", label: "Manage Spaces (Availability)" }}
      >
        How Timeline Templates work
      </LibraryDependencyNote>
      <TimelineTemplatesSection
        initialTemplates={templates}
        spaces={spaces}
        missingStarterKeys={missingStarterKeys}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate, startTime: e.startTime }))}
        headerCreate={false}
      />
    </div>
  );
}
