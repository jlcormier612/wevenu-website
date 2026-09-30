import type { Metadata } from "next";

import { PlanningStarterExamples } from "@/components/playbooks/planning-starter-examples";
import { PlaybookStarterPicker } from "@/components/playbooks/playbook-starter-picker";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { PlaybooksSection } from "@/components/settings/playbooks-section";
import { getEvents } from "@/lib/events/service";
import { getTemplatesForLibrary } from "@/lib/playbooks/service";

export const metadata: Metadata = { title: "Planning Templates" };

export default async function PlaybooksLibraryPage() {
  const [templates, events] = await Promise.all([
    getTemplatesForLibrary(),
    getEvents(),
  ]);
  const activeTemplates = templates.filter((t) => !t.isArchived);
  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Planning Templates"
        description="Create reusable planning checklists once, then apply them to events. Templates can include the planning capabilities your venue has enabled in Settings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PlaybookStarterPicker existingTemplates={activeTemplates} />
            <PlaybookStarterPicker existingTemplates={activeTemplates} variant="import" />
          </div>
        }
      />
      <LibraryHowItWorks>
        Client Planning is what your clients see; Venue Planning is your internal team checklist. Checklist items are authored in the template editor — there is no separate catalog to manage. Both use Preview, Edit, and Use the same way. Turn planning tools on or off for your whole venue in Settings → Leads &amp; Booking.
      </LibraryHowItWorks>
      <PlanningStarterExamples templates={templates} />
      <PlaybooksSection
        initialTemplates={templates}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
        headerCreate={false}
      />
    </div>
  );
}
