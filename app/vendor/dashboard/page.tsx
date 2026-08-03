import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorHome } from "@/components/vendor-app/vendor-home";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getVendorHomeData } from "@/lib/vendor-home/service";
import { getVendorActiveVenue, getVendorPartnerships } from "@/lib/vendor-partnerships/service";

export const metadata: Metadata = { title: "Home — Vendor Portal" };

export default async function VendorDashboardPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const [profile, data, activeVenue, partnerships] = await Promise.all([
    getVendorProfile(vendorUser.vendorId),
    getVendorHomeData(vendorUser.vendorId),
    getVendorActiveVenue(),
    getVendorPartnerships(),
  ]);

  // Greet the person, not the business — matches the coordinator dashboard's
  // own ownerFirstName convention (lib/dashboard/service.ts).
  const greetingName = profile?.contactName?.trim().split(" ")[0] || profile?.businessName || "there";

  return (
    <VendorHome
      greetingName={greetingName}
      data={data}
      activeVenue={activeVenue}
      partnerships={partnerships}
      vendorCategory={profile?.category ?? null}
    />
  );
}
