"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, BookPlus, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addPackageStarterAgainAction } from "@/app/(app)/library/packages/actions";
import { deletePackageAction, duplicatePackageAction, updatePackageAction } from "@/app/(app)/packages/actions";
import { LIBRARY_LABELS, archiveToggleLabel } from "@/components/library/labels";
import { LibraryArchivedSection } from "@/components/library/library-archived-section";
import { LibraryAssetCard } from "@/components/library/library-asset-card";
import { partitionArchived } from "@/components/library/partition-archived";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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
              <Button size="sm" variant="outline" render={<Link href={`/packages/${pkg.id}`} />}>
                {LIBRARY_LABELS.edit}
              </Button>
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
    setLoadingId(pkg.id);
    const result = await deletePackageAction(pkg.id);
    setLoadingId(null);
    if (result.ok) {
      setPackages((p) => p.filter((x) => x.id !== pkg.id));
      toast.success("Package deleted.");
    } else toast.error(result.message ?? "Could not delete.");
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

  const { active, archived } = partitionArchived(packages, (pkg) => !pkg.isActive);

  function cardFor(pkg: Package | PackageWithItems, archivedView: boolean) {
    return (
      <LibraryAssetCard
        key={pkg.id}
        title={pkg.name}
        description={pkg.description ? <span className="line-clamp-2">{pkg.description}</span> : undefined}
        isStarter={Boolean(pkg.sourceMasterKey)}
        isArchived={!pkg.isActive}
        badges={pkg.category ? <Badge variant="muted" className="text-[10px]">{pkg.category}</Badge> : undefined}
        primaryActions={archivedView
          ? [
              { id: "preview", label: LIBRARY_LABELS.preview, onClick: () => openPreview(pkg), emphasis: "preview" },
              { id: "restore", label: LIBRARY_LABELS.restore, onClick: () => handleToggleActive(pkg), emphasis: "edit" },
            ]
          : [
              { id: "preview", label: LIBRARY_LABELS.preview, onClick: () => openPreview(pkg), emphasis: "preview" },
              { id: "edit", label: LIBRARY_LABELS.edit, href: `/packages/${pkg.id}`, emphasis: "edit" },
            ]}
        overflowPending={loadingId === pkg.id}
        overflowItems={archivedView ? [] : [
          { id: "edit", label: LIBRARY_LABELS.edit, href: `/packages/${pkg.id}`, icon: <Pencil className="mr-2 h-3.5 w-3.5" /> },
          { id: "duplicate", label: LIBRARY_LABELS.duplicate, onClick: () => handleDuplicate(pkg), icon: <Copy className="mr-2 h-3.5 w-3.5" /> },
          {
            id: "archive",
            label: archiveToggleLabel(!pkg.isActive),
            onClick: () => handleToggleActive(pkg),
            separatorBefore: true,
            icon: pkg.isActive ? <Archive className="mr-2 h-3.5 w-3.5" /> : <ArchiveRestore className="mr-2 h-3.5 w-3.5" />,
          },
          {
            id: "delete",
            label: LIBRARY_LABELS.delete,
            onClick: () => handleDelete(pkg),
            destructive: true,
            icon: <Trash2 className="mr-2 h-3.5 w-3.5" />,
          },
        ]}
      >
        <p className={`text-lg font-semibold text-heading ${pkg.basePrice == null ? "text-base text-muted-foreground font-medium" : ""}`}>
          {formatPrice(pkg.basePrice)}
        </p>
      </LibraryAssetCard>
    );
  }

  return (
    <div className="space-y-4">
      {missingStarterKeys.length > 0 && (
        <div className="flex justify-end">
          <StarterMenu missingKeys={missingStarterKeys} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Packages are reusable structures for booking. Archiving hides them from the active list — it does not send anything to a client.
      </p>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No active packages. Restore one from Archived, or add a new package.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((pkg) => cardFor(pkg, false))}
        </div>
      )}
      <LibraryArchivedSection count={archived.length}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {archived.map((pkg) => cardFor(pkg, true))}
        </div>
      </LibraryArchivedSection>
      <PackagePreviewSheet pkg={preview} open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }} />
    </div>
  );
}
