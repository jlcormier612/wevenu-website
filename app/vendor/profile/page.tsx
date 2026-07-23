import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorProfileWorkspace } from "@/components/vendor-app/vendor-profile-workspace";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getVendorPackages } from "@/lib/vendor-packages/service";
import { getVendorFaqs } from "@/lib/vendor-faqs/service";
import { getVendorAvailability } from "@/lib/vendor-availability/service";

export const metadata: Metadata = { title: "Profile — Vendor Portal" };

export default async function VendorProfilePage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const now = new Date();
  const [profile, packages, faqs, availability] = await Promise.all([
    getVendorProfile(vendorUser.vendorId),
    getVendorPackages(vendorUser.vendorId),
    getVendorFaqs(vendorUser.vendorId),
    getVendorAvailability(vendorUser.vendorId, now.getFullYear(), now.getMonth() + 1),
  ]);
  if (!profile) redirect("/login");

  return (
    <VendorProfileWorkspace
      profile={profile}
      packages={packages}
      faqs={faqs}
      availability={availability}
      year={now.getFullYear()}
      month={now.getMonth()}
    />
  );
}
