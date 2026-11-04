import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { VendorForm } from "@/components/vendors/vendor-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Add Vendor" };

export default function NewVendorPage() {
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="vendor-new">
      <CollectionBackLink href="/vendors" label="Vendors" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title="Add Vendor" description="Add a vendor to your directory." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Vendor details</CardTitle>
          <CardDescription>Everything is editable later from the vendor record.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <VendorForm />
        </CardContent>
      </Card>
    </div>
  );
}
