import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorDetail } from "@/components/vendors/vendor-detail";
import { getDocuments } from "@/lib/documents/service";
import { getVendor } from "@/lib/vendors/service";
import { getVendorPortalSessions } from "@/lib/vendor-portal/service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const vendor = await getVendor(id);
  return { title: vendor?.name ?? "Vendor" };
}

export default async function VendorDetailPage({ params }: Props) {
  const { id } = await params;
  const [vendor, documents, portalSessions] = await Promise.all([
    getVendor(id), getDocuments("vendor", id), getVendorPortalSessions(id),
  ]);
  if (!vendor) notFound();
  return <VendorDetail vendor={vendor} documents={documents} portalSessions={portalSessions} />;
}
