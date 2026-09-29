import type { Metadata } from "next";

import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { EventOrderTemplateList } from "@/components/event-order-templates/event-order-template-list";
import { getEvents } from "@/lib/events/service";
import { ensureEventOrderStartersForCurrentVenue } from "@/lib/event-order-templates/provision";
import { getTemplates } from "@/lib/event-order-templates/service";
import { EVENT_ORDER_STARTER_MASTERS } from "@/lib/event-order-templates/starters";

export const metadata: Metadata = { title: "Event Order Templates" };

export default async function EventOrderTemplatesPage() {
  await ensureEventOrderStartersForCurrentVenue();
  const [templates, events] = await Promise.all([getTemplates(true), getEvents()]);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = EVENT_ORDER_STARTER_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Order Templates"
        description="Reusable Event Order structure — sections and optional priced offerings. Applying copies a snapshot into the event; it is not an invoice."
      />
      <LibraryHowItWorks>
        Build a reusable event-order structure using your offerings, then apply it to an event. The Library template stays unchanged.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        links={[
          { href: "/library/offerings", label: "Manage offerings →" },
          { href: "/library", label: "All templates →" },
        ]}
      >
        Uses offerings from your Offerings catalog when you add priced lines.
      </LibraryDependencyNote>
      <EventOrderTemplateList
        templates={templates}
        missingStarterKeys={missingStarterKeys}
        events={events.map((e) => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
      />
    </div>
  );
}
