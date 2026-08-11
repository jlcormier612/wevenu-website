"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Eye, Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addPackageStarterAgainAction } from "@/app/(app)/library/packages/actions";
import { deletePackageAction, duplicatePackageAction, updatePackageAction } from "@/app/(app)/packages/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatPrice } from "@/lib/packages/constants";
import {
  PACKAGE_STARTER_MASTERS,
  getPackageStarterMaster,
  type PackageStarterMasterKey,
} from "@/lib/packages/starters";
import type { Package, PackageWithItems } from "@/lib/packages/types";

function StarterMenu({ missingKeys }: { missingKeys: PackageStarterMasterKey[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (missingKeys.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button type="button" variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookPlus className="mr-1.5 h-4 w-4" />}
          Restore starters
        </Button>
      } />
      <DropdownMenuContent align="end">
        {PACKAGE_STARTER_MASTERS.filter((m) => missingKeys.includes(m.key)).map((m) => (
          <DropdownMenuItem
            key={m.key}
            onClick={() => startTransition(async () => {
              const r = await addPackageStarterAgainAction(m.key);
              if (r.ok) {
                toast.success("Starter added — your earlier customizations were left alone.");
                router.refresh();
              } else toast.error(r.message ?? "Could not add starter.");
            })}
          >
            {m.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PackagePreviewSheet({
  pkg,
  open,
  onOpenChange,
}: {
  pkg: PackageWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const master = pkg?.sourceMasterKey ? getPackageStarterMaster(pkg.sourceMasterKey) : undefined;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-2">
          <SheetTitle>{pkg?.name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <span>Package</span>
            {pkg?.sourceMasterKey && <Badge variant="muted">Starter</Badge>}
            {pkg && <span>· {formatPrice(pkg.basePrice)}</span>}
          </div>
        </SheetHeader>
        {pkg && (
          <div className="px-4 pb-6 space-y-4">
            {(pkg.description || master?.description) && (
              <p className="text-sm text-muted-foreground">{pkg.description || master?.description}</p>
            )}
            {pkg.sourceMasterKey && (
              <p className="text-xs text-muted-foreground">
                Hello to Cheers starter — customize spaces, services, and pricing to match your venue. This is a starting structure, not a claim about what you offer.
              </p>
            )}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">What&apos;s included</p>
              {pkg.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inclusions listed yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-foreground">
                  {pkg.items.map((item) => (
                    <li key={item.id} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0">•</span>
                      <span>
                        {item.quantity !== 1 && (
                          <span className="text-muted-foreground mr-1">
                            {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                          </span>
                        )}
                        {item.description}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" render={<Link href={`/packages/${pkg.id}`} />}>Edit package</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PackageList({
  initialPackages,
  missingStarterKeys = [],
}: {
  initialPackages: PackageWithItems[] | Package[];
  missingStarterKeys?: PackageStarterMasterKey[];
}) {
  const router = useRouter();
  const [packages, setPackages] = React.useState(initialPackages);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PackageWithItems | null>(null);

  React.useEffect(() => {
    setPackages(initialPackages);
  }, [initialPackages]);

  async function handleToggleActive(pkg: Package) {
    setLoadingId(pkg.id);
    const result = await updatePackageAction(pkg.id, {
      name: pkg.name,
      description: pkg.description ?? "",
      basePrice: pkg.basePrice == null ? "" : String(pkg.basePrice),
      category: pkg.category ?? "",
      isActive: !pkg.isActive,
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

  function openPreview(pkg: Package | PackageWithItems) {
    const withItems: PackageWithItems = {
      ...pkg,
      items: "items" in pkg ? pkg.items : [],
    };
    setPreview(withItems);
  }

  if (packages.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <StarterMenu missingKeys={missingStarterKeys} />
        </div>
        <div className="rounded-sm border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-heading">No packages yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your venue offerings, or restore Hello to Cheers starters to customize.
          </p>
          <Button type="button" size="sm" className="mt-4" render={<Link href="/packages/new" />}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Package
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {missingStarterKeys.length > 0 && (
        <div className="flex justify-end">
          <StarterMenu missingKeys={missingStarterKeys} />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`group relative rounded-sm border bg-card p-5 transition-opacity ${pkg.isActive ? "border-border" : "border-border opacity-60"}`}
          >
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {pkg.category && <Badge variant="muted" className="text-xs">{pkg.category}</Badge>}
              {pkg.sourceMasterKey && pkg.isActive && (
                <Badge variant="muted" className="text-xs">Starter</Badge>
              )}
              {!pkg.isActive && <Badge variant="muted" className="text-xs">Archived</Badge>}
            </div>
            <div className="space-y-1 mb-4">
              <h3 className="font-medium text-heading text-sm leading-tight">{pkg.name}</h3>
              {pkg.description && <p className="text-xs text-muted-foreground line-clamp-2">{pkg.description}</p>}
            </div>
            <div className="flex items-center justify-between">
              <p className={`text-lg font-semibold text-heading ${pkg.basePrice == null ? "text-base text-muted-foreground font-medium" : ""}`}>
                {formatPrice(pkg.basePrice)}
              </p>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Package options" />}>
                    {loadingId === pkg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openPreview(pkg)}>
                      <Eye className="mr-2 h-3.5 w-3.5" /> Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href={`/packages/${pkg.id}`} />}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(pkg)}>
                      <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
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
      <PackagePreviewSheet pkg={preview} open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }} />
    </div>
  );
}
