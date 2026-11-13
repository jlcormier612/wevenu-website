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

export const metadata: Metadata = { title: "Event Order plans" };

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
          title="Event Order plans"
          description="Reusable delivery plans with always-included items and couple choice groups from your choices catalog."
          actions={<NewEventOrderTemplateButton />}
        />
      </div>
      <div data-testid="eo-templates-landing-example">
        <LibraryDependencyNote
          tone="calm"
          detail={
            <>
              Always-included items stay on the plan; couple choices (like Buffet vs Plated) come from
              your choices catalog — they only see the options you pick. Preview shows the couple
              experience without sending. Use applies to an event&apos;s Event Order; Send is only for
              plans with client choice groups. Apply copies a snapshot — later edits never rewrite a
              booked Event Order. Distinct from sales Packages — neither creates an invoice.
            </>
          }
          action={{ href: "/library/offerings", label: "Manage choices catalog" }}
        >
          How Event Order plans work
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
