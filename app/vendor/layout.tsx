import { redirect } from "next/navigation";

import { VendorAppShell } from "@/components/vendor-app/vendor-app-shell";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getPendingTaskCount } from "@/lib/vendor-tasks/service";
import { getInquiryCounts } from "@/lib/vendor-inquiries/service";

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/login");

  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const [profile, pendingTaskCount, inquiryCounts] = await Promise.all([
    getVendorProfile(vendorUser.vendorId),
    getPendingTaskCount(vendorUser.vendorId),
    getInquiryCounts(vendorUser.vendorId),
  ]);

  const newInquiryCount = inquiryCounts.new ?? 0;

  return (
    <VendorAppShell
      businessName={profile?.businessName ?? "Your Business"}
      category={profile?.category ?? null}
      role={vendorUser.role}
      newInquiryCount={newInquiryCount}
      pendingTaskCount={pendingTaskCount}
    >
      {children}
    </VendorAppShell>
  );
}
