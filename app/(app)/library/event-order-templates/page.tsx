import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/module-placeholder";
import { EventOrderTemplateList } from "@/components/event-order-templates/event-order-template-list";
import { ensureEventOrderStartersForCurrentVenue } from "@/lib/event-order-templates/provision";
import { getTemplates } from "@/lib/event-order-templates/service";
import { EVENT_ORDER_STARTER_MASTERS } from "@/lib/event-order-templates/starters";

export const metadata: Metadata = { title: "Event Order Templates" };

export default async function EventOrderTemplatesPage() {
  await ensureEventOrderStartersForCurrentVenue();
  const templates = await getTemplates(true);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = EVENT_ORDER_STARTER_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Order Templates"
        description="Reusable starting points for the Event Orders you create for your events — sections and standard lines, ready to customize."
      />
      <EventOrderTemplateList templates={templates} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
