import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorDashboard } from "@/components/vendor-app/vendor-dashboard";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorDashboardData } from "@/lib/vendor-profile/service";

export const metadata: Metadata = { title: "Dashboard — Vendor Portal" };

export default async function VendorDashboardPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const data = await getVendorDashboardData(vendorUser.vendorId);
  if (!data) redirect("/login");

  return <VendorDashboard data={data} />;
}
