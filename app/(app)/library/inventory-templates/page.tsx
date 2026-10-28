import type { Metadata } from "next";

import {
  InventoryTemplateList,
  NewInventoryTemplateButton,
} from "@/components/event-inventory/inventory-template-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { ensureInventoryStartersForCurrentVenue } from "@/lib/inventory/provision";
import { INVENTORY_TEMPLATE_STARTER_MASTERS } from "@/lib/inventory/starters";
import { getTemplates } from "@/lib/event-inventory/service";
import { getTemplateApplyClientGroups } from "@/lib/library/template-apply-targets-service";

export const metadata: Metadata = { title: "Inventory Templates" };

export default async function InventoryTemplatesLibraryPage() {
  await ensureInventoryStartersForCurrentVenue();
  const [templates, clientGroups] = await Promise.all([
    getTemplates(true),
    getTemplateApplyClientGroups(),
  ]);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = INVENTORY_TEMPLATE_STARTER_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Inventory Templates"
        description="Reusable starting lists for the inventory you typically provide at an event. Apply one to an event, then customize that event’s inventory as needed."
        actions={<NewInventoryTemplateButton />}
      />
      <LibraryHowItWorks>
        <strong className="font-medium text-heading">Use</strong> applies the list to an event without
        sharing it.{" "}
        <strong className="font-medium text-heading">Send to client</strong> applies it if needed and
        shares the event inventory for the couple to review.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Add catalog items when you edit a template. Use a custom line only for one-offs that are not already in your catalog."
        action={{ href: "/library/inventory", label: "Manage Available Inventory" }}
      >
        Built from your Available Inventory catalog.
      </LibraryDependencyNote>
      <InventoryTemplateList
        templates={templates}
        missingStarterKeys={missingStarterKeys}
        clientGroups={clientGroups}
        headerCreate={false}
      />
    </div>
  );
}
