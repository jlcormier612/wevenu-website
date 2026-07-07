import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorProfileForm } from "@/components/vendor-app/vendor-profile-form";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import type { VendorProfile } from "@/lib/vendors/types";

export const metadata: Metadata = { title: "My Profile — Vendor Portal" };

export default async function VendorProfilePage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const profile = await getVendorProfile(vendorUser.vendorId);
  if (!profile) redirect("/login");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Keep your business details up to date. Changes are visible to connected venues immediately.
        </p>
      </div>
      <VendorProfileForm profile={profile} />
    </div>
  );
}
