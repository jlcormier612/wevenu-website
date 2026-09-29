import type { Metadata } from "next";

import { ChoicesTemplateList } from "@/components/client-choices-templates/choices-template-list";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { getTemplates } from "@/lib/client-choices-templates/service";
import { getEvents } from "@/lib/events/service";

export const metadata: Metadata = { title: "Choices Templates" };

export default async function ChoicesTemplatesPage() {
  const [templates, events] = await Promise.all([getTemplates(true), getEvents()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Choices Templates"
        description="Reusable client choice forms — menus, bar, linens, rentals, and other post-booking decisions."
      />
      <LibraryHowItWorks>
        Build the questions and options once. Use Template on an event to create that event&apos;s client choices from this template.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Need to add or change sellable options? Manage them in Offerings. When you edit this template, you can attach offerings as options (or write custom option labels)."
        action={{ href: "/library/offerings", label: "Manage Offerings" }}
      >
        Options can use offerings from your Offerings catalog.
      </LibraryDependencyNote>
      <ChoicesTemplateList
        templates={templates}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
      />
    </div>
  );
}
