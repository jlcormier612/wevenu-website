import type { Metadata } from "next";
import Link from "next/link";

import { VendorList } from "@/components/vendors/vendor-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getVendors } from "@/lib/vendors/service";

export const metadata: Metadata = { title: "Vendor Library" };

export default async function VendorsPage() {
  const vendors = await getVendors();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Library"
        description="Your preferred vendors and event partners — recommend any of these to a specific client from their event."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link href="/settings/import?type=vendors" />}>
              Import Vendors
            </Button>
            <Button render={<Link href="/vendors/new" />}>
              + Add Vendor
            </Button>
          </div>
        }
      />
      <VendorList vendors={vendors} />
    </div>
  );
}
