import type { Metadata } from "next";
import Link from "next/link";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { InventoryLibrarySection } from "@/components/inventory/inventory-library-section";
import { ensureInventoryStartersForCurrentVenue } from "@/lib/inventory/provision";
import { getItemsForLibrary } from "@/lib/inventory/service";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryLibraryPage() {
  await ensureInventoryStartersForCurrentVenue();
  const items = await getItemsForLibrary();
  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Available Inventory"
        description="Physical stock your venue owns — create and edit items here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button render={<Link href="/library/inventory/new" />}>
              + New Inventory Item
            </Button>
            <Button variant="outline" render={<Link href="/settings/import?type=inventory" />}>
              Import Inventory
            </Button>
          </div>
        }
      />
      <LibraryHowItWorks>
        Create inventory items here. Floor Plan Templates can place items marked for floor plans. On an event, you can select these items when building that event&apos;s inventory list.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="Mark items for floor plans when they should appear in the floor-plan editor. Inventory Templates are reusable checklists authored separately — apply them to an event, then add catalog items on the event if needed."
        action={{ href: "/library/floor-plan-templates", label: "Open Floor Plan Templates" }}
        secondaryActions={[
          { href: "/library/inventory-templates", label: "Open Inventory Templates" },
        ]}
      >
        Used when placing furniture on floor plans and when adding stock to an event&apos;s inventory.
      </LibraryDependencyNote>
      <InventoryLibrarySection initialItems={items} />
    </div>
  );
}
