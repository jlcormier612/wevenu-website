import { redirect } from "next/navigation";

import { VendorAppShell } from "@/components/vendor-app/vendor-app-shell";
import { createVendorClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorBriefing, getVendorLuvAttentionCount } from "@/lib/luv/vendor-observations";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorHomeData } from "@/lib/vendor-home/service";
import { getVendorLuvExtras } from "@/lib/vendor-luv/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getPendingTaskCount } from "@/lib/vendor-tasks/service";
import { getVendorConversationInbox } from "@/lib/conversations/service";

export const dynamic = "force-dynamic";

/**
 * Authenticated vendor workspace shell — vendor cookie jar only.
 */
export default async function VendorWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/vendor/login");

  const supabase = await createVendorClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/vendor/login?next=%2Fvendor%2Fdashboard");
  }

  const vendorUser = await getVendorUser();
  if (!vendorUser) {
    redirect("/vendor/login?next=%2Fvendor%2Fdashboard");
  }

  const [profile, pendingTaskCount, conversationInbox, home, luvExtras] = await Promise.all([
    getVendorProfile(vendorUser.vendorId),
    getPendingTaskCount(vendorUser.vendorId),
    getVendorConversationInbox(),
    getVendorHomeData(vendorUser.vendorId),
    getVendorLuvExtras(),
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
    extras: luvExtras,
  });

  return (
    <VendorAppShell
      businessName={profile?.businessName ?? "Your Business"}
      category={profile?.category ?? null}
      logoUrl={profile?.logoUrl ?? null}
      role={vendorUser.role}
      pendingTaskCount={pendingTaskCount}
      unreadMessageCount={conversationInbox.totalUnread}
      luvAttentionCount={getVendorLuvAttentionCount(briefing)}
    >
      {children}
    </VendorAppShell>
  );
}
