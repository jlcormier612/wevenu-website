import type { Metadata } from "next";

import {
  EventOrderTemplateList,
  NewEventOrderTemplateButton,
} from "@/components/event-order-templates/event-order-template-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
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
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Event Order Templates"
        description="Reusable packages for a wedding’s Event Order — always-on items and couple choices selected from your Offerings."
        actions={<NewEventOrderTemplateButton />}
      />
      <LibraryHowItWorks>
        An Event Order template is the reusable package you apply to a booked event. You decide items
        always on the package (with clear package-price vs additional-charge treatment) and Couple&apos;s
        choices selected from your Offerings — for example Buffet or Plated dinner, with which child
        Offerings are available under each. Customize a starter or build your own; Preview shows the couple experience without sending
        anything. Use applies the template to an event&apos;s Event Order; Send is only for templates with
        couple choices.
      </LibraryHowItWorks>
      <div
        className="rounded-sm border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-1.5"
        data-testid="eo-templates-landing-example"
      >
        <p className="font-medium text-heading">Example</p>
        <p>
          Ceremony coordination stays always on the package. Couples choose dinner service (Buffet or
          Plated) from your Offerings. Under Buffet they only see the child Offerings you selected for
          that package.
        </p>
      </div>
      <LibraryDependencyNote
        detail="Prefer reusable Offerings for items you sell across events; use a template-only line when it belongs only here. Linking an Offering to Inventory elsewhere does not reserve stock. Applying copies a snapshot — later catalog price edits do not rewrite existing event orders."
        action={{ href: "/library/offerings", label: "Manage Offerings" }}
      >
        Templates can use your Offerings catalog or template-only items.
      </LibraryDependencyNote>
      <EventOrderTemplateList
        templates={templates}
        missingStarterKeys={missingStarterKeys}
        clientGroups={clientGroups}
        headerCreate={false}
      />
    </div>
  );
}
