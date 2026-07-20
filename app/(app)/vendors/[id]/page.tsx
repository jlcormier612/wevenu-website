import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorDetail } from "@/components/vendors/vendor-detail";
import { getDocuments } from "@/lib/documents/service";
import { getVendor, getVendorReviews } from "@/lib/vendors/service";
import { getVendorRelationshipRollup } from "@/lib/conversations/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor?.businessName ?? "Vendor" };
}

export default async function VendorDetailPage({ params }: Props) {
  const { id } = await params;
  const vendor = await getVendor(id);
  if (!vendor) notFound();
  const [documents, reviews, conversations] = await Promise.all([
    getDocuments("vendor", id),
    getVendorReviews(id),
    vendor.vendorRelationshipId ? getVendorRelationshipRollup(vendor.vendorRelationshipId) : Promise.resolve([]),
  ]);
  return <VendorDetail vendor={vendor} documents={documents} reviews={reviews} conversations={conversations} />;
}
