import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorDetail } from "@/components/vendors/vendor-detail";
import { getDocuments } from "@/lib/documents/service";
import { getVendor } from "@/lib/vendors/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor?.name ?? "Vendor" };
}

export default async function VendorDetailPage({ params }: Props) {
  const { id } = await params;
  const [vendor, documents] = await Promise.all([getVendor(id), getDocuments("vendor", id)]);
  if (!vendor) notFound();
  return <VendorDetail vendor={vendor} documents={documents} />;
}
