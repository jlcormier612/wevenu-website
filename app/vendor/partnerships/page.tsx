import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorPartnershipsList } from "@/components/vendor-app/vendor-partnerships-list";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorPartnerships } from "@/lib/vendor-partnerships/service";

export const metadata: Metadata = { title: "Your Venues — Vendor Portal" };

// Program 4, Initiative C, Phase 10 (2026-07-23) — "The Vendor Workspace is
// not a CRM. It exists to strengthen the Vendor's relationship with
// participating Venues." Every venue relationship this vendor has, with
// the one thing they can edit here: their venue-specific promotion.
//
// Venue-First Dashboard (2026-07-24) — no longer primary nav; "Venue
// Partnerships" read like a LinkedIn connections list rather than a real
// relationship, so the Dashboard now leads with the vendor's active venue
// directly (VendorVenueHero) and this page is reached only from its
// switcher, for vendors with more than one relationship. Renamed
// accordingly — "Your Venues" describes what it actually is.
export default async function VendorPartnershipsPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const partnerships = await getVendorPartnerships();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Your Venues</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every venue you work with on Hello to Cheers, and the promotion couples see on your profile at each one.
        </p>
      </div>
      <VendorPartnershipsList partnerships={partnerships} />
    </div>
  );
}
