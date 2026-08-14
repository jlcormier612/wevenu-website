import type { Metadata } from "next";

import { InventoryTemplateList } from "@/components/event-inventory/inventory-template-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { ensureInventoryStartersForCurrentVenue } from "@/lib/inventory/provision";
import { INVENTORY_TEMPLATE_STARTER_MASTERS } from "@/lib/inventory/starters";
import { getTemplates } from "@/lib/event-inventory/service";

export const metadata: Metadata = { title: "Inventory Templates" };

export default async function InventoryTemplatesLibraryPage() {
  await ensureInventoryStartersForCurrentVenue();
  const templates = await getTemplates(true);
  const presentKeys = new Set(templates.map((t) => t.sourceMasterKey).filter(Boolean));
  const missingStarterKeys = INVENTORY_TEMPLATE_STARTER_MASTERS
    .filter((m) => !presentKeys.has(m.key))
    .map((m) => m.key);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Templates"
        description="What you typically use for a kind of event. Customize a starter, then apply it to create Working Inventory for a booking."
      />
      <InventoryTemplateList templates={templates} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
