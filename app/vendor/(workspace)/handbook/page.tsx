import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorHandbookPicker } from "@/components/vendor-app/vendor-handbook-picker";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorHandbooks } from "@/lib/vendor-handbook/service";

export const metadata: Metadata = { title: "Venue Information — Vendor Portal" };

export default async function VendorHandbookPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const handbooks = await getVendorHandbooks();
  return <VendorHandbookPicker handbooks={handbooks} />;
}
