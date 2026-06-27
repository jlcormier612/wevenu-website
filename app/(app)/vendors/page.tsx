import type { Metadata } from "next";
import Link from "next/link";

import { VendorList } from "@/components/vendors/vendor-list";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getVendors } from "@/lib/vendors/service";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const vendors = await getVendors();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description="Your preferred vendors and event partners."
        actions={
          <Button render={<Link href="/vendors/new" />}>
            + Add Vendor
          </Button>
        }
      />
      <VendorList vendors={vendors} />
    </div>
  );
}
