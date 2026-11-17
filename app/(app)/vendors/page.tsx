import type { Metadata } from "next";
import Link from "next/link";

import { RequiredVendorCategoriesPanel } from "@/components/vendors/required-vendor-categories-panel";
import { VendorList } from "@/components/vendors/vendor-list";
import { SetupHubReturnLink } from "@/components/setup-hub/phase-b1/setup-hub-return-link";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Button } from "@/components/ui/button";
import { getVenueRequiredVendorCategories } from "@/lib/vendors/required-categories";
import { getVendors } from "@/lib/vendors/service";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage() {
  const [vendors, requiredCategories] = await Promise.all([
    getVendors(),
    getVenueRequiredVendorCategories(),
  ]);
  return (
    <div className="htc-hospitality-page space-y-4 sm:space-y-6">
      <SetupHubReturnLink href="/setup-hub/make-htc-yours/event-experiences" label="Back to Your event experiences" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Vendors"
          description="Vendors you make available to couples. Recommend or prefer them, mark required or in-house, and invite them to claim their profile."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<Link href="/setup-hub/bring-your-business?stage=vendors" />}>
                Import Vendors
              </Button>
              <Button render={<Link href="/vendors/new" />}>
                + Add Vendor
              </Button>
            </div>
          }
        />
      </div>
      <RequiredVendorCategoriesPanel initialCategories={requiredCategories} />
      <VendorList vendors={vendors} />
    </div>
  );
}
