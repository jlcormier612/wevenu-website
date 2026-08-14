"use client";

/**
 * The Inventory Library — a card grid, one card per item (Inventory
 * Foundation task). Mirrors the Floor Plan Template Library's card shape.
 * No multi-flow starter picker (Blank/Duplicate/Upload) — inventory items
 * don't have "starter flows," so "+ New Inventory Item" is a plain link to
 * a dedicated create page, same pattern as Pipeline Templates.
 */

import * as React from "react";

import Link from "next/link";
import { Package } from "lucide-react";
import { toast } from "sonner";

import { setItemArchivedAction } from "@/app/(app)/library/inventory/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { InventoryItemWithCategory } from "@/lib/inventory/types";

function dimensions(item: InventoryItemWithCategory): string | null {
  const parts = [item.width, item.length, item.height].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return [item.width, item.length, item.height].map((v) => (v != null ? `${v}"` : "—")).join(" × ");
}

function ItemCard({
  item, busy, onArchiveToggle, archivedView,
}: {
  item: InventoryItemWithCategory;
  busy: boolean;
  onArchiveToggle: () => void;
  archivedView?: boolean;
}) {
  const dims = dimensions(item);

  return (
    <LibraryAssetCard
      title={item.name}
      isArchived={item.isArchived}
      badges={
        <>
          {item.categoryName && <Badge variant="outline" className="text-[10px]">{item.categoryName}</Badge>}
          {item.availableForFloorPlans && <Badge variant="accent" className="text-[10px]">Floor Plans</Badge>}
        </>
      }
      meta={`${item.quantityAvailable} available${dims ? ` · ${dims}` : ""}`}
      primaryActions={archivedView
        ? [{ id: "restore", label: LIBRARY_LABELS.restore, onClick: onArchiveToggle, emphasis: "edit" }]
        : [{ id: "edit", label: LIBRARY_LABELS.edit, href: `/library/inventory/${item.id}/edit`, emphasis: "edit" }]}
      overflowPending={busy}
      overflowItems={archivedView ? [] : [
        { id: "edit", label: LIBRARY_LABELS.edit, href: `/library/inventory/${item.id}/edit` },
        {
          id: "archive",
          label: archiveToggleLabel(item.isArchived),
          onClick: onArchiveToggle,
          separatorBefore: true,
        },
      ]}
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-24 w-full rounded-lg border border-border/60 bg-muted/40 object-contain" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border/60 text-muted-foreground">
          <Package className="h-6 w-6" />
        </div>
      )}
    </LibraryAssetCard>
  );
}

export function InventoryLibrarySection({ initialItems }: { initialItems: InventoryItemWithCategory[] }) {
  const [items, setItems] = React.useState(initialItems);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function handleArchiveToggle(id: string, isArchived: boolean) {
    setBusyId(id);
    const result = await setItemArchivedAction(id, !isArchived);
    setBusyId(null);
    if (result.ok) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isArchived: !isArchived } : i)));
      toast.success(isArchived ? "Item restored." : "Item archived.");
    } else {
      toast.error(result.message ?? "Something went wrong.");
    }
  }

  const sorted = React.useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  const { active, archived } = React.useMemo(
    () => partitionArchived(sorted, (i) => i.isArchived),
    [sorted],
  );

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center space-y-3">
        <Package className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-heading">No inventory yet</p>
        <p className="text-xs text-muted-foreground">Tables, chairs, decor, and anything else you reuse across bookings.</p>
        <div className="flex justify-center pt-1">
          <Button render={<Link href="/library/inventory/new" />}>+ New Inventory Item</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button render={<Link href="/library/inventory/new" />}>+ New Inventory Item</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Catalog items are venue inventory — editing never sends anything to a client.
      </p>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No active inventory items.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((item) => (
            <ItemCard
              key={item.id} item={item} busy={busyId === item.id}
              onArchiveToggle={() => handleArchiveToggle(item.id, item.isArchived)}
            />
          ))}
        </div>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {archived.map((item) => (
            <ItemCard
              key={item.id} item={item} busy={busyId === item.id} archivedView
              onArchiveToggle={() => handleArchiveToggle(item.id, item.isArchived)}
            />
          ))}
        </div>
      </LibraryArchivedSection>
    </div>
  );
}
