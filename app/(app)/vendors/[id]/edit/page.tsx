import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { VendorEditForm } from "@/components/vendors/vendor-edit-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getVendor } from "@/lib/vendors/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor ? `Edit · ${vendor.businessName}` : "Edit Vendor" };
}

export default async function EditVendorPage({ params }: Props) {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="vendor-edit">
      <CollectionBackLink href={`/vendors/${vendor.id}`} label={vendor.businessName} />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title={`Edit · ${vendor.businessName}`} description="Update vendor details." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Vendor details</CardTitle>
          <CardDescription>Changes take effect immediately.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <VendorEditForm vendor={vendor} />
        </CardContent>
      </Card>
    </div>
  );
}
