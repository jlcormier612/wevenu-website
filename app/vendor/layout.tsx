import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { StaffLegalAcceptance } from "@/components/legal/staff-legal-acceptance";
import { VendorAppShell } from "@/components/vendor-app/vendor-app-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getLegalGateStatus,
  VENDOR_PORTAL_LEGAL_TYPES,
} from "@/lib/legal/service";
import { getVendorBriefing, getVendorLuvAttentionCount } from "@/lib/luv/vendor-observations";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorHomeData } from "@/lib/vendor-home/service";
import { getVendorLuvExtras } from "@/lib/vendor-luv/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getPendingTaskCount } from "@/lib/vendor-tasks/service";
import { getVendorConversationInbox } from "@/lib/conversations/service";

function isVendorAcceptPath(pathname: string): boolean {
  return pathname === "/vendor/accept" || pathname.startsWith("/vendor/accept/");
}

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  // Invitation claim is public (proxy PUBLIC_PATHS) and must not require an
  // existing vendor_users row — first-time claimers have a session (or none)
  // but no membership until ClaimButton succeeds. Skipping the shell here
  // avoids login ↔ accept loops with ?next=.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (isVendorAcceptPath(pathname)) {
    return children;
  }

  if (!isSupabaseConfigured) redirect("/login");

  const vendorUser = await getVendorUser();
  if (!vendorUser) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const legalGate = await getLegalGateStatus(user.id, VENDOR_PORTAL_LEGAL_TYPES);
  if (legalGate.needsAcceptance) {
    return (
      <StaffLegalAcceptance
        portal="vendor"
        documents={legalGate.documents}
        title="Review vendor terms"
        checkboxLabel="I have read and agree to the Vendor End User Terms and Privacy Policy."
      />
    );
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
