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
      <CollectionBackLink href="/library/event-order-templates" label="Event Order plans" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Choices catalog"
          description="Reusable menus, bar, services, and upgrades that power Event Order plans. Editing here does not send choices to clients."
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
        detail="These choices power Event Order plans — open a plan to decide what couples can select. Optionally link a choice to a physical inventory item for stock awareness. Distinct from Available Inventory and from sales Packages."
        action={{ href: "/library/event-order-templates", label: "Open Event Order plans" }}
        secondaryActions={[
          { href: "/library/inventory", label: "Manage Available Inventory" },
        ]}
      >
        How the choices catalog works
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
