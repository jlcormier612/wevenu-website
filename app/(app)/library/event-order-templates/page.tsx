import type { Metadata } from "next";

import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { EventOrderTemplateList } from "@/components/event-order-templates/event-order-template-list";
import { ensureEventOrderStartersForCurrentVenue } from "@/lib/event-order-templates/provision";
import { getTemplates } from "@/lib/event-order-templates/service";
import { EVENT_ORDER_STARTER_MASTERS } from "@/lib/event-order-templates/starters";
import { getTemplateApplyClientGroups } from "@/lib/library/template-apply-targets-service";

export const metadata: Metadata = { title: "Event Order Templates" };

export default async function EventOrderTemplatesPage() {
  await ensureEventOrderStartersForCurrentVenue();
  const [templates, clientGroups] = await Promise.all([
    getTemplates(true),
    getTemplateApplyClientGroups(),
  ]);
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
        Assemble a reusable order once. Use Template on a client booking to snapshot those lines into that event&apos;s Event Order.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="When you edit a template, select offerings from your catalog first. Add a custom line only when something is not already in Offerings. Applying copies a snapshot into the event — later catalog price changes do not rewrite existing event orders."
        action={{ href: "/library/offerings", label: "Manage Offerings" }}
      >
        Built from your Offerings catalog.
      </LibraryDependencyNote>
      <EventOrderTemplateList
        templates={templates}
        missingStarterKeys={missingStarterKeys}
        clientGroups={clientGroups}
      />
    </div>
  );
}
