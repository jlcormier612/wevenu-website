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
        description="Menus, bar, services, and rentals you provide — create and edit them here."
        actions={
          <Button type="button" onClick={() => sectionRef.current?.openCreate()}>
            + New Offering
          </Button>
        }
      />
      <LibraryHowItWorks>
        Create sellable offerings here. Event Order Templates select from this catalog when you build fixed lines and choice options.
      </LibraryHowItWorks>
      <LibraryDependencyNote
        detail="After you add or update offerings here, open an Event Order Template and select which offerings to include as fixed lines or choice options. You can optionally link an offering to a physical inventory item."
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
