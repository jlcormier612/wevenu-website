import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PackageList } from "@/components/packages/package-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensurePackageStartersForCurrentVenue } from "@/lib/packages/provision";
import { getPackagesWithItems } from "@/lib/packages/service";
import { PACKAGE_STARTER_MASTERS, type PackageStarterMasterKey } from "@/lib/packages/starters";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesLibraryPage() {
  await ensurePackageStartersForCurrentVenue();
  const packages = await getPackagesWithItems();
  const presentKeys = new Set(
    packages.map((p) => p.sourceMasterKey).filter((k): k is string => Boolean(k)),
  );
  const missingStarterKeys = PACKAGE_STARTER_MASTERS
    .map((m) => m.key)
    .filter((k) => !presentKeys.has(k)) as PackageStarterMasterKey[];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Packages"
          description="Define your venue offerings. Hello to Cheers starters are starting points to customize — set your pricing before using them on invoices or Event Orders."
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" render={<Link href="/settings/import?type=packages" />}>
            Import Packages
          </Button>
          <Button render={<Link href="/packages/new" />}>
            <Plus className="mr-1.5 h-4 w-4" /> New Package
          </Button>
        </div>
      </div>
      <PackageList initialPackages={packages} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
