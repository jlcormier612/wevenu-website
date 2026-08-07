import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordStaffActivity } from "@/lib/activation/service";

/**
 * Protected layout for the venue workspace. Confirms an authenticated session
 * (defense in depth alongside the proxy), then enforces the foundational rule:
 * nothing in VenueOS exists until the venue exists. Without a completed venue,
 * the user is sent to Venue Setup.
 *
 * Legal acceptance for returning users is enforced by Legal Middleware in
 * `integrations/supabase/proxy.ts` → `/welcome` (WP4). This layout no longer
 * mounts a parallel staff-legal gate.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const venue = await getCurrentVenue();
  if (!venue?.setupCompleted) {
    const vendorUser = await getVendorUser();
    if (vendorUser) redirect("/vendor/dashboard");
    redirect("/setup");
  }

  // Defense in depth alongside proxy hard-lock for CRM Suspend / unpaid dunning.
  if (venue.accessDisabled || venue.accountStatus === "suspended") {
    redirect("/billing/suspended");
  }

  void recordStaffActivity(user.id);

  return (
    <WorkspaceShell
      email={user.email ?? ""}
      venueName={venue.name}
      venueLogo={venue.logoUrl}
    >
      {children}
    </WorkspaceShell>
  );
}
