import { redirect } from "next/navigation";

import { VendorAppShell } from "@/components/vendor-app/vendor-app-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorBriefing, getVendorLuvAttentionCount } from "@/lib/luv/vendor-observations";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorHomeData } from "@/lib/vendor-home/service";
import { getVendorLuvExtras } from "@/lib/vendor-luv/service";
import { getVendorProfile } from "@/lib/vendor-profile/service";
import { getPendingTaskCount } from "@/lib/vendor-tasks/service";
import { getVendorConversationInbox } from "@/lib/conversations/service";

// Redirects based on isSupabaseConfigured before touching a dynamic API —
// without this, Next.js can statically prerender that redirect at build
// time and cache it indefinitely, serving it to every request regardless
// of actual session state.
export const dynamic = "force-dynamic";

/**
 * Authenticated vendor workspace shell.
 *
 * Invitation claim (`/vendor/accept`) lives outside this route group so a
 * soft navigation after claim always mounts this layout fresh — previously
 * a shared layout conditionally skipped the shell on accept, and client
 * navigations to /vendor/dashboard could leave the portal without nav.
 *
 * Legal acceptance is enforced by Legal Middleware
 * (`integrations/supabase/proxy.ts` → `/welcome`).
 */
export default async function VendorWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fvendor%2Fdashboard");
  }

  const vendorUser = await getVendorUser();
  if (!vendorUser) {
    // Signed in but not a vendor — do not bounce to bare /login (that used to
    // dump venue staff straight into /dashboard and look like a "hijack").
    const { data: venueId } = await supabase.rpc("current_user_venue_id");
    if (venueId) redirect("/workspaces");
    redirect("/login?next=%2Fvendor%2Fdashboard");
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
