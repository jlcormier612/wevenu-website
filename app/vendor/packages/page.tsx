import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorPackagesManager } from "@/components/vendor-app/vendor-packages-manager";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorPackages } from "@/lib/vendor-packages/service";

export const metadata: Metadata = { title: "Packages — Vendor Portal" };

export default async function VendorPackagesPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const packages = await getVendorPackages(vendorUser.vendorId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Service Packages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define the services you offer so venues can match you to the right events.
        </p>
      </div>
      <VendorPackagesManager packages={packages} />
    </div>
  );
}
