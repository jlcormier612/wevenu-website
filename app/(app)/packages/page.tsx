import type { Metadata } from "next";

import Link from "next/link";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { LibraryHowItWorks } from "@/components/library/library-guidance";
import { PackageList } from "@/components/packages/package-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { ensurePackageStartersForCurrentVenue } from "@/lib/packages/provision";
import { getPackagesWithItems } from "@/lib/packages/service";
import { PACKAGE_STARTER_MASTERS, type PackageStarterMasterKey } from "@/lib/packages/starters";
import { isSetupHubReturn, withSetupHubReturn } from "@/lib/setup-hub/phase-b1-routes";

export const metadata: Metadata = { title: "Packages & Pricing" };

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  await ensurePackageStartersForCurrentVenue();
  const packages = await getPackagesWithItems();
  const presentKeys = new Set(
    packages.map((p) => p.sourceMasterKey).filter((k): k is string => Boolean(k)),
  );
  const missingStarterKeys = PACKAGE_STARTER_MASTERS
    .map((m) => m.key)
    .filter((k) => !presentKeys.has(k)) as PackageStarterMasterKey[];
  const newPackageHref = isSetupHubReturn(params.from)
    ? withSetupHubReturn("/packages/new", "booking-process")
    : "/packages/new";

  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/booking-process" label="Back to your booking process" />
      <CollectionBackLink href="/library" label="Library" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Packages & Pricing"
          description="Priced offers you sell before booking. Inclusions are your commercial story — not Event Order choices."
          actions={
            <Button type="button" render={<Link href={newPackageHref} />}>
              + New package
            </Button>
          }
        />
      </div>
      <LibraryHowItWorks tone="calm">
        Author package names, pricing, and inclusion lines here. Inclusions are written on the package itself — they are not selected from the choices catalog. For delivery plans and couple choice groups, use Event Order plans.
      </LibraryHowItWorks>
      <PackageList initialPackages={packages} missingStarterKeys={missingStarterKeys} />
    </div>
  );
}
