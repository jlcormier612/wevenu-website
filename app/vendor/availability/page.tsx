import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorAvailabilityManager } from "@/components/vendor-app/vendor-availability-manager";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorAvailability } from "@/lib/vendor-availability/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";

export const metadata: Metadata = { title: "Availability — Vendor Portal" };

export default async function VendorAvailabilityPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const now = new Date();
  const [profile, availability] = await Promise.all([
    getVendorProfile(vendorUser.vendorId),
    getVendorAvailability(vendorUser.vendorId, now.getFullYear(), now.getMonth() + 1),
  ]);

  if (!profile) redirect("/login");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Availability</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mark dates you're unavailable and set your inquiry preferences.
        </p>
      </div>
      <VendorAvailabilityManager
        availability={availability}
        year={now.getFullYear()}
        month={now.getMonth()}
        acceptingInquiries={profile.acceptingInquiries}
        availabilityNotes={profile.availabilityNotes}
      />
    </div>
  );
}
