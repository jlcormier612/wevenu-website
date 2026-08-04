/**
 * Vendor Luv data loader — same Daily Briefing job as venue coordinators,
 * fed by vendor-home + profile facts. Unread vendor_notifications land via
 * VendorLuvExtras.notifications (light alerts, not a second inbox).
 */
import { getVendorBriefing, getVendorLuvAttentionCount, type VendorLuvExtras } from "@/lib/luv/vendor-observations";
import type { LuvBriefing } from "@/lib/luv/briefing-types";
import { getVendorHomeData } from "@/lib/vendor-home/service";
import { getVendorNotifications } from "@/lib/vendor-notifications/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { vendorNotificationsToBriefingItems } from "@/lib/vendor-luv/notifications";

export type VendorLuvPageData = {
  briefing: LuvBriefing;
  attentionCount: number;
  showIntro: boolean;
  greetingName: string;
};

/** Fetch + map unread vendor_notifications for the Luv extras hook. */
export async function getVendorLuvExtras(): Promise<VendorLuvExtras> {
  const { notifications } = await getVendorNotifications(20);
  return {
    notifications: vendorNotificationsToBriefingItems(notifications),
  };
}

export async function getVendorLuvPageData(
  vendorId: string,
  extras?: VendorLuvExtras,
): Promise<VendorLuvPageData> {
  const [home, profile, resolvedExtras] = await Promise.all([
    getVendorHomeData(vendorId),
    getVendorProfile(vendorId),
    extras ? Promise.resolve(extras) : getVendorLuvExtras(),
  ]);

  const briefing = getVendorBriefing({
    home,
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
    extras: resolvedExtras,
  });

  return {
    briefing,
    attentionCount: getVendorLuvAttentionCount(briefing),
    showIntro: !profile?.luvIntroSeenAt,
    greetingName:
      profile?.contactName?.trim().split(" ")[0] ||
      profile?.businessName ||
      "there",
  };
}
