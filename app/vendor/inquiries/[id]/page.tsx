import { notFound, redirect } from "next/navigation";

import { VendorInquiryDetail } from "@/components/vendor-app/vendor-inquiry-detail";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorInquiry } from "@/lib/vendor-inquiries/service";
import { getVendorTasks } from "@/lib/vendor-tasks/service";

export default async function VendorInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const [inquiry, tasks] = await Promise.all([
    getVendorInquiry(id, vendorUser.vendorId),
    getVendorTasks(vendorUser.vendorId, {}),
  ]);

  if (!inquiry) notFound();

  const linkedTasks = tasks.filter((t) => t.vendorInquiryId === id);

  return <VendorInquiryDetail inquiry={inquiry} linkedTasks={linkedTasks} />;
}
