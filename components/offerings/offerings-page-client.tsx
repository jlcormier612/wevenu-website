"use client";

/**
 * Offerings catalog page shell — PageHeader owns green + New Offering;
 * Available Inventory stays a guidance/dependency link, not a header CTA.
 */

import * as React from "react";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { LibraryDependencyNote } from "@/components/library/library-guidance";
import { OfferingsLibrarySection } from "@/components/offerings/offerings-library-section";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import type { OfferingChoiceGroup } from "@/lib/offerings/choice-groups";
import type { InventoryItem } from "@/lib/inventory/types";
import type { OfferingCategory, OfferingWithCategory } from "@/lib/offerings/types";

export function OfferingsPageClient({
  venueId,
  initialOfferings,
  categories,
  inventoryItems,
  initialChoiceGroups = [],
}: {
  venueId: string;
  initialOfferings: OfferingWithCategory[];
  categories: OfferingCategory[];
  inventoryItems: InventoryItem[];
  initialChoiceGroups?: OfferingChoiceGroup[];
}) {
  const sectionRef = React.useRef<{ openCreate: () => void } | null>(null);

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <CollectionBackLink href="/library" label="Library" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Offerings Catalog"
          description="Manage the services, packages, upgrades, and choices available for clients to select."
          actions={
            <Button
              type="button"
              data-testid="offerings-new"
              onClick={() => {
                const open = () => sectionRef.current?.openCreate();
                open();
                // Sheet mounts via client ref — retry once if first paint raced the click.
                if (!sectionRef.current) requestAnimationFrame(open);
              }}
            >
              + New choice
            </Button>
          }
        />
      </div>
      <LibraryDependencyNote
        tone="calm"
        detail="Event Order Templates use these offerings to define what's included and which choices clients can select. Editing the catalog does not send choices to clients or apply an Event Order. Optionally link an offering to a physical inventory item — stock is reserved when the couple approves the Event Order. Distinct from Available Inventory."
        action={{ href: "/library/event-order-templates", label: "Open Event Order Templates" }}
        secondaryActions={[
          { href: "/library/inventory", label: "Manage Available Inventory" },
        ]}
      >
        How Offerings Catalog works
      </LibraryDependencyNote>
      <OfferingsLibrarySection
        ref={sectionRef}
        venueId={venueId}
        initialOfferings={initialOfferings}
        categories={categories}
        inventoryItems={inventoryItems}
        initialChoiceGroups={initialChoiceGroups}
        headerCreate={false}
      />
    </div>
  );
}
