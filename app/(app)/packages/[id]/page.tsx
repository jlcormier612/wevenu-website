import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CollectionBackLink } from "@/components/library/collection-back-link";
import { PackageForm } from "@/components/packages/package-form";
import { PackageInclusionsEditor } from "@/components/packages/package-inclusions-editor";
import { PageHeader } from "@/components/shell/module-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listOfferings } from "@/lib/offerings/service";
import { getPackage } from "@/lib/packages/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const pkg = await getPackage(id);
  return { title: pkg ? `Edit · ${pkg.name}` : "Package not found" };
}

export default async function EditPackagePage({ params }: Props) {
  const { id } = await params;
  const [pkg, offerings] = await Promise.all([getPackage(id), listOfferings()]);
  if (!pkg) notFound();
  return (
    <div className="htc-hospitality-page space-y-5 sm:space-y-6" data-htc-phase12="package-edit">
      <CollectionBackLink href="/packages" label="Packages" />
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title={`Edit · ${pkg.name}`}
          description={
            pkg.sourceMasterKey
              ? "Hello to Cheers starter — customize inclusions and set your pricing. Changes never rewrite Event Orders or invoices that already used this package."
              : "Update this package's details and pricing."
          }
        />
      </div>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Package details</CardTitle>
          <CardDescription>
            Catalog changes apply to future invoices and Event Orders only — existing committed lines keep their snapshotted values.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <PackageForm existing={pkg} />
        </CardContent>
      </Card>
      <Card className="htc-working-card gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>What&apos;s Included</CardTitle>
          <CardDescription>List everything a client receives in this package. Inclusions appear on invoices and print documents.</CardDescription>
        </CardHeader>
        <CardContent className="py-5">
          <PackageInclusionsEditor packageId={pkg.id} initialItems={pkg.items} offerings={offerings} />
        </CardContent>
      </Card>
    </div>
  );
}
