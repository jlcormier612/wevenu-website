import type { Metadata } from "next";

import {
  EventOrderTemplateList,
  NewEventOrderTemplateButton,
} from "@/components/event-order-templates/event-order-template-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
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
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Library" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Event Order Templates"
          description="Create and manage reusable client selection experiences."
          actions={<NewEventOrderTemplateButton />}
        />
      </div>
      <div data-testid="eo-templates-landing-example">
        <LibraryDependencyNote
          tone="calm"
          detail={
            <>
              Examples in a starter are not included or priced until you configure them. Items you
              mark Included stay on the template; Additional items carry the price you enter. Client
              selections (like Buffet vs Plated) come from the options you keep. Preview shows the client experience without sending. Apply copies a snapshot — later edits never rewrite
              a booked Event Order. Distinct from sales Packages — neither creates an invoice.
            </>
          }
          action={{ href: "/library/offerings", label: "Open Offerings Catalog" }}
        >
          How Event Order Templates work
        </LibraryDependencyNote>
      </div>
      <EventOrderTemplateList
        templates={templates}
        missingStarterKeys={missingStarterKeys}
        clientGroups={clientGroups}
        headerCreate={false}
      />
    </div>
  );
}
