import type { Metadata } from "next";

import Link from "next/link";
import { Plus } from "lucide-react";

import { PackageList } from "@/components/packages/package-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getPackages } from "@/lib/packages/service";

export const metadata: Metadata = { title: "Packages & Inventory" };

export default async function PackagesPage() {
  const packages = await getPackages();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Packages & Inventory"
          description="Define your venue offerings. Packages can be added as line items on invoices."
        />
        <Button type="button" render={<Link href="/packages/new" />} className="shrink-0">
          <Plus className="mr-1 h-4 w-4" /> Add Package
        </Button>
      </div>
      <PackageList initialPackages={packages} />
    </div>
  );
}
