"use client";

/**
 * Offerings catalog page shell — PageHeader owns green + New Offering;
 * Available Inventory stays a guidance/dependency link, not a header CTA.
 */

import * as React from "react";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote, LibraryHowItWorks } from "@/components/library/library-guidance";
import { OfferingsLibrarySection } from "@/components/offerings/offerings-library-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import type { InventoryItem } from "@/lib/inventory/types";
import type { OfferingCategory, OfferingWithCategory } from "@/lib/offerings/types";

export function OfferingsPageClient({
  initialOfferings,
  categories,
  inventoryItems,
}: {
  initialOfferings: OfferingWithCategory[];
  categories: OfferingCategory[];
  inventoryItems: InventoryItem[];
}) {
  const sectionRef = React.useRef<{ openCreate: () => void } | null>(null);

  return (
    <div className="space-y-6">
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Offerings"
        description="Organize what this venue sells by service category — major choices and the items that belong under them. Catalog edits do not change what a couple must select on an Event Order."
        actions={
          <Button type="button" onClick={() => sectionRef.current?.openCreate()}>
            + New Offering
          </Button>
        }
      />
      <LibraryHowItWorks>
        Maintain reusable offerings here: service categories, major choices (for example a dinner style or bar package), and associated menu or package items nested under those choices. Event Order Templates select from this same catalog for included lines, primary choices, and follow-ups — without duplicating records. Client selection and Event Order finalization happen on the event, not on this page.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="After you organize offerings here, open an Event Order Template and select which catalog items apply as included lines, major choices, or follow-up items. Optionally link an offering to a physical inventory item (does not reserve stock). Applying or sending a template is an event action from Event Order Templates or the event workspace."
        action={{ href: "/library/event-order-templates", label: "Open Event Order Templates" }}
        secondaryActions={[
          { href: "/library/inventory", label: "Manage Available Inventory" },
        ]}
      >
        Used by Event Order Templates.
      </LibraryDependencyNote>
      <OfferingsLibrarySection
        ref={sectionRef}
        initialOfferings={initialOfferings}
        categories={categories}
        inventoryItems={inventoryItems}
        headerCreate={false}
      />
    </div>
  );
}
