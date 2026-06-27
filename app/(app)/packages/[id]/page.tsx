import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PackageForm } from "@/components/packages/package-form";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPackage } from "@/lib/packages/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pkg = await getPackage(id);
  return { title: pkg ? `Edit · ${pkg.name}` : "Package not found" };
}

export default async function EditPackagePage({ params }: Props) {
  const { id } = await params;
  const pkg = await getPackage(id);
  if (!pkg) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={`Edit · ${pkg.name}`} description="Update this package's details and pricing." />
      <Card>
        <CardHeader>
          <CardTitle>Package details</CardTitle>
          <CardDescription>Changes apply to future invoices — existing line items are not updated.</CardDescription>
        </CardHeader>
        <CardContent><PackageForm existing={pkg} /></CardContent>
      </Card>
    </div>
  );
}
