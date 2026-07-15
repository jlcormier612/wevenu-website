"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deletePackageAction, duplicatePackageAction, updatePackageAction } from "@/app/(app)/packages/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/packages/constants";
import type { Package } from "@/lib/packages/types";

export function PackageList({ initialPackages }: { initialPackages: Package[] }) {
  const router = useRouter();
  const [packages, setPackages] = React.useState(initialPackages);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  async function handleToggleActive(pkg: Package) {
    setLoadingId(pkg.id);
    const result = await updatePackageAction(pkg.id, {
      name: pkg.name, description: pkg.description ?? "", basePrice: String(pkg.basePrice),
      category: pkg.category ?? "", isActive: !pkg.isActive,
    });
    setLoadingId(null);
    if (result.ok) {
      setPackages((p) => p.map((x) => x.id === pkg.id ? { ...x, isActive: !pkg.isActive } : x));
    } else toast.error(result.message ?? "Could not update package.");
  }

  async function handleDelete(pkg: Package) {
    if (!confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;
    setPackages((p) => p.filter((x) => x.id !== pkg.id));
    const result = await deletePackageAction(pkg.id);
    if (!result.ok) { toast.error(result.message ?? "Could not delete."); router.refresh(); }
  }

  async function handleDuplicate(pkg: Package) {
    setLoadingId(pkg.id);
    const result = await duplicatePackageAction(pkg.id, `${pkg.name} (Copy)`);
    setLoadingId(null);
    if (result.ok) { toast.success("Package duplicated."); router.push(`/packages/${result.packageId}`); }
    else toast.error(result.message ?? "Could not duplicate package.");
  }

  if (packages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-sm font-medium text-heading">No packages yet</p>
        <p className="text-xs text-muted-foreground mt-1">Add your venue packages to use them on invoices.</p>
        <Button type="button" size="sm" className="mt-4" render={<Link href="/packages/new" />}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Package
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {packages.map((pkg) => (
        <div key={pkg.id} className={`group relative rounded-xl border bg-card p-5 transition-opacity ${pkg.isActive ? "border-border" : "border-border opacity-60"}`}>
          {/* Category badge */}
          {pkg.category && (
            <Badge variant="muted" className="mb-3 text-xs">{pkg.category}</Badge>
          )}
          <div className="space-y-1 mb-4">
            <h3 className="font-medium text-heading text-sm leading-tight">{pkg.name}</h3>
            {pkg.description && <p className="text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-heading">{formatPrice(pkg.basePrice)}</p>
            <div className="flex items-center gap-1">
              {!pkg.isActive && <Badge variant="muted" className="text-xs">Archived</Badge>}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Package options" />}>
                  {loadingId === pkg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link href={`/packages/${pkg.id}`} />}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDuplicate(pkg)}>
                    <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleActive(pkg)}>
                    {pkg.isActive ? <Archive className="mr-2 h-3.5 w-3.5" /> : <ArchiveRestore className="mr-2 h-3.5 w-3.5" />}
                    {pkg.isActive ? "Archive" : "Restore"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDelete(pkg)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
