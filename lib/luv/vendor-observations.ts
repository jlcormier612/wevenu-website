/**
 * Luv — vendor-facing observations.
 *
 * Luv Experience Completion, Work Stream 1: retires the two verbatim
 * copies of computeLuvData() that used to live independently in
 * app/vendor/luv/page.tsx and components/vendor-app/vendor-dashboard.tsx
 * — a genuine, undocumented fork of the coordinator dashboard's Luv
 * pattern, doubled by its own internal duplication. This is that logic's
 * one real home in lib/luv/, mirroring portal-observations.ts's shape:
 * pure, stateless, computed fresh from data the caller already fetched
 * (VendorDashboardData) — no new query, no AI call.
 *
 * Tone (Work Stream 4): professional hospitality — a trusted operations
 * partner, not a cheerleader and not a cold status feed. States what's
 * true and what it means, never a bare command or an alarm.
 */
import type { VendorDashboardData } from "@/lib/vendors/types";

export type VendorLuvBriefingData = {
  wins: string[];
  observations: string[];
};

export function getVendorObservations(data: VendorDashboardData): VendorLuvBriefingData {
  const wins: string[] = [];
  const observations: string[] = [];
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const recentVenues = data.venues.filter((v) => v.addedAt >= sevenDaysAgo);
  if (recentVenues.length > 0) {
    wins.push(`You connected with ${recentVenues.length} new ${recentVenues.length === 1 ? "venue" : "venues"} this week.`);
  }
  if (data.upcomingEvents.length > 0) {
    wins.push(`${data.upcomingEvents.length} upcoming ${data.upcomingEvents.length === 1 ? "event is" : "events are"} confirmed.`);
  }

  if (data.newInquiryCount > 0) {
    observations.push(`${data.newInquiryCount} new ${data.newInquiryCount === 1 ? "inquiry is" : "inquiries are"} waiting for a response.`);
  }
  if (data.pendingTaskCount > 0) {
    observations.push(`${data.pendingTaskCount} ${data.pendingTaskCount === 1 ? "task is" : "tasks are"} coming up — completing ${data.pendingTaskCount === 1 ? "it" : "them"} now helps the venue stay on schedule.`);
  }

  const profile = data.vendor;
  if (profile.insuranceExpiry) {
    const daysLeft = Math.ceil(
      (new Date(profile.insuranceExpiry).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysLeft > 0 && daysLeft <= 30) {
      observations.push(`Your certificate of insurance expires in ${daysLeft} days — renewing now keeps your profile in good standing.`);
    }
  }

  const profileFields = [
    profile.businessName, profile.category, profile.description,
    profile.contactName, profile.email, profile.phone,
    profile.pricingTier, profile.serviceArea,
  ];
  if (profileFields.filter(Boolean).length < 6) {
    observations.push("Your profile is missing a few details venues look for — completing it helps you stand out.");
  }

  return { wins, observations };
}
