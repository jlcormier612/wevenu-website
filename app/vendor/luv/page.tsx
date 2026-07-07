import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { VendorLuvBriefing } from "@/components/vendor-app/vendor-luv-briefing";
import { VendorHealthScoreWidget } from "@/components/vendor-app/vendor-health-score-widget";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorDashboardData } from "@/lib/vendor-profile/service";

export const metadata: Metadata = { title: "Luv — Vendor Portal" };

function computeLuvData(data: Awaited<ReturnType<typeof getVendorDashboardData>>) {
  if (!data) return { wins: [], observations: [] };
  const wins: string[] = [];
  const observations: string[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentVenues = data.venues.filter((v) => v.addedAt >= sevenDaysAgo);
  if (recentVenues.length > 0) {
    wins.push(`Connected with ${recentVenues.length} new ${recentVenues.length === 1 ? "venue" : "venues"} this week`);
  }
  if (data.upcomingEvents.length > 0) {
    wins.push(`${data.upcomingEvents.length} upcoming ${data.upcomingEvents.length === 1 ? "event" : "events"} confirmed`);
  }
  if (data.newInquiryCount > 0) {
    observations.push(`${data.newInquiryCount} new ${data.newInquiryCount === 1 ? "inquiry" : "inquiries"} waiting for a response`);
  }
  if (data.pendingTaskCount > 0) {
    observations.push(`${data.pendingTaskCount} ${data.pendingTaskCount === 1 ? "task is" : "tasks are"} due soon`);
  }
  const profile = data.vendor;
  if (profile.insuranceExpiry) {
    const daysLeft = Math.ceil(
      (new Date(profile.insuranceExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysLeft > 0 && daysLeft <= 30) {
      observations.push(`Insurance expires in ${daysLeft} days — renew soon`);
    }
  }
  const profileFields = [
    profile.businessName, profile.category, profile.description,
    profile.contactName, profile.email, profile.phone,
    profile.pricingTier, profile.serviceArea,
  ];
  if (profileFields.filter(Boolean).length < 6) {
    observations.push("Profile is incomplete — finish it to improve your business health score");
  }
  return { wins, observations };
}

export default async function VendorLuvPage() {
  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const data = await getVendorDashboardData(vendorUser.vendorId);
  const { wins, observations } = computeLuvData(data);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Luv</h1>
        <p className="text-sm text-muted-foreground">Your built-in business assistant.</p>
      </div>

      <VendorLuvBriefing
        wins={wins}
        observations={observations}
        healthTip={data?.healthScore?.luvTip}
      />

      {data?.healthScore && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Business Health</h2>
          <VendorHealthScoreWidget health={data.healthScore} />
        </div>
      )}
    </div>
  );
}
