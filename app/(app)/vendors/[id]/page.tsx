import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VendorDetail } from "@/components/vendors/vendor-detail";
import { getPinnedDocumentKeys, getRecentInteractionMap, getVenueWorkspaceDocuments } from "@/lib/document-workspace/service";
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
  const [workspaceDocuments, pinnedKeys, recentMap, reviews, conversations] = await Promise.all([
    getVenueWorkspaceDocuments({ vendorId: id }),
    getPinnedDocumentKeys(),
    getRecentInteractionMap(),
    getVendorReviews(id),
    vendor.vendorRelationshipId ? getVendorRelationshipRollup(vendor.vendorRelationshipId) : Promise.resolve([]),
  ]);
  return (
    <VendorDetail
      vendor={vendor}
      workspaceDocuments={workspaceDocuments}
      pinnedDocumentKeys={[...pinnedKeys]}
      recentDocumentEntries={[...recentMap.entries()]}
      reviews={reviews}
      conversations={conversations}
    />
  );
}
