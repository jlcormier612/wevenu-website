import type { Metadata } from "next";

import {
  InventoryTemplateList,
  NewInventoryTemplateButton,
} from "@/components/event-inventory/inventory-template-list";
import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { ensureInventoryStartersForCurrentVenue } from "@/lib/inventory/provision";
import { INVENTORY_TEMPLATE_STARTER_MASTERS } from "@/lib/inventory/starters";
import { getTemplates } from "@/lib/event-inventory/service";
import { getTemplateApplyClientGroups } from "@/lib/library/template-apply-targets-service";

export const metadata: Metadata = { title: "Saved starting lists" };

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
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library/inventory" label="Available Inventory" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Saved starting lists"
          description="Reusable starting lists for Items for this event. Apply one to an event, review quantities there, then share from the event when ready."
          actions={<NewInventoryTemplateButton />}
        />
      </div>
      <LibraryDependencyNote
        tone="calm"
          detail={
            <>
              <strong className="font-medium text-heading">Use on event</strong> applies the list as that event&apos;s editable copy without sharing. Share quantities with the couple from the event workspace after you review real counts — not from this Library list. Built from your Available Inventory catalog.
            </>
          }
        action={{ href: "/library/inventory", label: "Manage Available Inventory" }}
      >
        How saved starting lists work
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
