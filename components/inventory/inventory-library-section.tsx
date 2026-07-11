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
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Package } from "lucide-react";
import { toast } from "sonner";

import { setItemArchivedAction } from "@/app/(app)/library/inventory/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InventoryItemWithCategory } from "@/lib/inventory/types";

function sortItems(items: InventoryItemWithCategory[]): InventoryItemWithCategory[] {
  return [...items].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

function dimensions(item: InventoryItemWithCategory): string | null {
  const parts = [item.width, item.length, item.height].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return [item.width, item.length, item.height].map((v) => (v != null ? `${v}"` : "—")).join(" × ");
}

function ItemCard({
  item, busy, onArchiveToggle,
}: { item: InventoryItemWithCategory; busy: boolean; onArchiveToggle: () => void }) {
  const router = useRouter();
  const dims = dimensions(item);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/library/inventory/${item.id}/edit`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/library/inventory/${item.id}/edit`); }}
      className={`group flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 ${item.isArchived ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-heading">{item.name}</p>
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} />}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/library/inventory/${item.id}/edit`)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={onArchiveToggle}>{item.isArchived ? "Unarchive" : "Archive"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-24 w-full rounded-lg border border-border/60 object-cover" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border/60 text-muted-foreground">
          <Package className="h-6 w-6" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {item.categoryName && <Badge variant="outline" className="text-[10px]">{item.categoryName}</Badge>}
        {item.availableForFloorPlans && <Badge variant="accent" className="text-[10px]">Floor Plans</Badge>}
        {item.isArchived && <Badge variant="muted" className="text-[10px]">Archived</Badge>}
      </div>

      <p className="mt-auto text-xs text-muted-foreground">
        {item.quantityAvailable} available{dims ? ` · ${dims}` : ""}
      </p>
    </div>
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
      toast.success(isArchived ? "Item unarchived." : "Item archived.");
    } else {
      toast.error(result.message ?? "Something went wrong.");
    }
  }

  const sorted = React.useMemo(() => sortItems(items), [items]);

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((item) => (
          <ItemCard
            key={item.id} item={item} busy={busyId === item.id}
            onArchiveToggle={() => handleArchiveToggle(item.id, item.isArchived)}
          />
        ))}
      </div>
    </div>
  );
}
