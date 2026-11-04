import type { Metadata } from "next";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PackageForm } from "@/components/packages/package-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Package" };

export default function NewPackagePage() {
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="package-new">
      <CollectionBackLink href="/packages" label="Packages" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader title="New Package" description="Add an offering to your venue catalog." />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Package details</CardTitle>
          <CardDescription>Packages can be selected as line items when creating invoices.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <PackageForm />
        </CardContent>
      </Card>
    </div>
  );
}
