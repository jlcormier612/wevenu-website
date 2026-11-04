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
      <CollectionBackLink href="/library" label="Templates" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Offerings"
          description="Organize the services, packages, and options your venue offers. Group related items under choices, such as dinner styles or bar packages, so you can reuse them across Event Order Templates."
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
              + New Offering
            </Button>
          }
        />
      </div>
      <LibraryDependencyNote
        tone="calm"
        detail="Maintain your catalog here. Event Order Templates use these offerings to define what's included and which choices or additional items clients can select. Optionally link an offering to a physical inventory item — stock is reserved when the couple approves the Event Order. Distinct from Available Inventory."
        action={{ href: "/library/event-order-templates", label: "Open Event Order Templates" }}
        secondaryActions={[
          { href: "/library/inventory", label: "Manage Available Inventory" },
        ]}
      >
        How Offerings work
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
