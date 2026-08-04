import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorHome } from "@/components/vendor-app/vendor-home";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getVendorHomeData } from "@/lib/vendor-home/service";
import { getVendorActiveVenue, getVendorPartnerships } from "@/lib/vendor-partnerships/service";
import { getVendorBriefing } from "@/lib/luv/vendor-observations";
import { getVendorLuvExtras } from "@/lib/vendor-luv/service";

export const metadata: Metadata = { title: "Home — Vendor Portal" };

export default async function VendorDashboardPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const [profile, data, activeVenue, partnerships, luvExtras] = await Promise.all([
    getVendorProfile(vendorUser.vendorId),
    getVendorHomeData(vendorUser.vendorId),
    getVendorActiveVenue(),
    getVendorPartnerships(),
    getVendorLuvExtras(),
  ]);

  // Greet the person, not the business — matches the coordinator dashboard's
  // own ownerFirstName convention (lib/dashboard/service.ts).
  const greetingName = profile?.contactName?.trim().split(" ")[0] || profile?.businessName || "there";

  const briefing = getVendorBriefing({
    home: data,
    profile: profile
      ? {
          businessName: profile.businessName,
          contactName: profile.contactName,
          category: profile.category,
          description: profile.description,
          email: profile.email,
          phone: profile.phone,
          pricingTier: profile.pricingTier,
          serviceArea: profile.serviceArea,
          insuranceExpiry: profile.insuranceExpiry,
        }
      : null,
    extras: luvExtras,
  });

  return (
    <VendorHome
      greetingName={greetingName}
      data={data}
      briefing={briefing}
      showLuvIntro={!profile?.luvIntroSeenAt}
      activeVenue={activeVenue}
      partnerships={partnerships}
      vendorCategory={profile?.category ?? null}
    />
  );
}
