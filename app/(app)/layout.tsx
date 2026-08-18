import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordStaffActivity } from "@/lib/activation/service";

// Reads cookies via createClient()/redirects based on isSupabaseConfigured
// before any dynamic API call — without this, Next.js can statically
// prerender the redirect at build time (when Supabase env vars may be
// unavailable) and cache it indefinitely, serving a stale redirect to
// every real request regardless of actual session state.
export const dynamic = "force-dynamic";

/**
 * Protected layout for the venue workspace. Confirms an authenticated session
 * (defense in depth alongside the proxy), then enforces the foundational rule:
 * nothing in VenueOS exists until the venue exists. No venue row yet sends
 * the user to the Venue Setup wizard (which can create one); a venue that
 * exists but hasn't finished setup sends them to Setup Hub instead.
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
  if (!venue) {
    // No venue row at all (e.g. activation never finished creating one) —
    // Setup Hub itself requires a venue to render anything and returns
    // blank without one, so this case still goes through the wizard that
    // can create one from scratch.
    const vendorUser = await getVendorUser();
    if (vendorUser) redirect("/vendor/dashboard");
    redirect("/setup");
  }
  if (!venue.setupCompleted) {
    const vendorUser = await getVendorUser();
    if (vendorUser) redirect("/vendor/dashboard");
    // /setup-hub itself lives inside this same (app) group, so without this
    // check every request for it would re-enter this branch and redirect
    // to itself in a loop. Everything else under (app) still bounces to it.
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!pathname.startsWith("/setup-hub")) {
      redirect("/setup-hub");
    }
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
