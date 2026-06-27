import type { Metadata } from "next";

import { VendorForm } from "@/components/vendors/vendor-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Add Vendor" };

export default function NewVendorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Add Vendor" description="Add a vendor to your directory." />
      <Card>
        <CardHeader>
          <CardTitle>Vendor details</CardTitle>
          <CardDescription>Everything is editable later from the vendor record.</CardDescription>
        </CardHeader>
        <CardContent>
          <VendorForm />
        </CardContent>
      </Card>
    </div>
  );
}
