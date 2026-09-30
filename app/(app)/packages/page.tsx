import type { Metadata } from "next";

import Link from "next/link";

import { CollectionBackLink } from "@/components/library/collection-back-link";
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
      <CollectionBackLink href="/library" label="Templates" />
      <PageHeader
        title="Packages"
        description="Define package tiers and inclusions. Customize starters, set pricing, then use them on invoices and Event Orders."
        actions={
          <Button type="button" render={<Link href="/packages/new" />}>
            + New Package
          </Button>
        }
      />
      <LibraryHowItWorks>
        Package names, pricing, and inclusion lines are authored here. Inclusions are written on the package itself — they are not selected from the Offerings catalog.
      </LibraryHowItWorks>
      <PackageList initialPackages={packages} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
