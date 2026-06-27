import type { Metadata } from "next";

import { PackageForm } from "@/components/packages/package-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "New Package" };

export default function NewPackagePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Package" description="Add an offering to your venue catalog." />
      <Card>
        <CardHeader>
          <CardTitle>Package details</CardTitle>
          <CardDescription>Packages can be selected as line items when creating invoices.</CardDescription>
        </CardHeader>
        <CardContent><PackageForm /></CardContent>
      </Card>
    </div>
  );
}
