import type { Metadata } from "next";

import Link from "next/link";
import { Plus } from "lucide-react";

import { LibraryHowItWorks } from "@/components/library/library-guidance";
import { PackageList } from "@/components/packages/package-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensurePackageStartersForCurrentVenue } from "@/lib/packages/provision";
import { getPackagesWithItems } from "@/lib/packages/service";
import { PACKAGE_STARTER_MASTERS, type PackageStarterMasterKey } from "@/lib/packages/starters";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
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
          description="Define package tiers and inclusions. Customize starters, set pricing, then use them on invoices and Event Orders."
        />
        <Button type="button" render={<Link href="/packages/new" />} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Add Package
        </Button>
      </div>
      <LibraryHowItWorks>
        Package names, pricing, and inclusion lines are authored here. Inclusions are written on the package itself — they are not selected from the Offerings catalog.
      </LibraryHowItWorks>
      <PackageList initialPackages={packages} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
