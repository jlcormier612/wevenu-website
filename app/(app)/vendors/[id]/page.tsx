import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorDetail } from "@/components/vendors/vendor-detail";
import { getDocuments } from "@/lib/documents/service";
import { getVendor, getVendorReviews } from "@/lib/vendors/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor?.businessName ?? "Vendor" };
}

export default async function VendorDetailPage({ params }: Props) {
  const { id } = await params;
  const [vendor, documents, reviews] = await Promise.all([
    getVendor(id), getDocuments("vendor", id), getVendorReviews(id),
  ]);
  if (!vendor) notFound();
  return <VendorDetail vendor={vendor} documents={documents} reviews={reviews} />;
}
