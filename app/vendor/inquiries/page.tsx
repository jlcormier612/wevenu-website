import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorInquiryPipeline } from "@/components/vendor-app/vendor-inquiry-pipeline";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorInquiries, getInquiryCounts } from "@/lib/vendor-inquiries/service";

export const metadata: Metadata = { title: "Inquiries — Vendor Portal" };

export default async function VendorInquiriesPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const [inquiries, counts] = await Promise.all([
    getVendorInquiries(vendorUser.vendorId),
    getInquiryCounts(vendorUser.vendorId),
  ]);

  return <VendorInquiryPipeline inquiries={inquiries} counts={counts} />;
}
