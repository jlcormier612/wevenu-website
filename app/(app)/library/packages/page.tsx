import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PackageList } from "@/components/packages/package-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getPackages } from "@/lib/packages/service";

export const metadata: Metadata = { title: "Package Templates" };

export default async function PackagesLibraryPage() {
  const packages = await getPackages();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Package Templates"
          description="Define your venue offerings. Packages can be added as line items on invoices."
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" render={<Link href="/settings/import?type=packages" />}>
            Import Package Templates
          </Button>
          <Button render={<Link href="/packages/new" />}>
            <Plus className="mr-1.5 h-4 w-4" /> New Package Template
          </Button>
        </div>
      </div>
      <PackageList initialPackages={packages} />
    </div>
  );
}
