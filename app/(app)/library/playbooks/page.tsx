import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { getEvents } from "@/lib/events/service";
import { getTemplatesForLibrary } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "Planning Templates" };

export default async function PlaybooksLibraryPage() {
  const [templates, events] = await Promise.all([getTemplatesForLibrary(), getEvents()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning Templates"
        description="Reusable checklists you refine once, then apply to each event. Preview any template to see what's inside — applying always creates that event's own editable copy."
      />
      <PlaybooksSection
        initialTemplates={templates}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
      />
    </div>
  );
}
