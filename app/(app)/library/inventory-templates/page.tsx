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
        description="Reusable packing lists for a kind of event. Use applies a draft snapshot to the event Inventory tab (does not share). Send applies and shares for portal review — continue selection, finalize, and Event Order handoff on the event. Neither creates an invoice."
        actions={<NewInventoryTemplateButton />}
      />
      <LibraryHowItWorks>
        Build a reusable packing list once from Available Inventory. Use starts that event&apos;s inventory draft without sharing. Send is an event shortcut that applies (if needed) and shares for portal review — then work continues on the event Inventory tab.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Add items from Available Inventory when you edit a template. Use a custom line only for one-offs that are not already in your catalog. Applying a template copies a snapshot onto the event."
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
