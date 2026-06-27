import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorEditForm } from "@/components/vendors/vendor-edit-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getVendor } from "@/lib/vendors/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor ? `Edit · ${vendor.name}` : "Edit Vendor" };
}

export default async function EditVendorPage({ params }: Props) {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit · ${vendor.name}`} description="Update vendor details." />
      <Card>
        <CardHeader>
          <CardTitle>Vendor details</CardTitle>
          <CardDescription>Changes take effect immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <VendorEditForm vendor={vendor} />
        </CardContent>
      </Card>
    </div>
  );
}
