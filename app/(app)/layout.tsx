import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isPreGraduationAllowedPath } from "@/lib/setup-hub/pre-graduation-paths";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
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
    // No venue row — may be a vendor-only or client-only identity. Never dump
    // those users into Venue Setup (/setup); that is the venue onboarding path.
    const vendorUser = await getVendorUser();
    if (vendorUser) redirect("/vendor/dashboard");

    const { data: portalSession } = await supabase
      .from("client_portal_sessions")
      .select("access_token")
      .eq("client_user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ access_token: string }>();
    if (portalSession?.access_token) {
      redirect(`/p/${portalSession.access_token}`);
    }

    redirect("/setup");
  }
  if (!venue.setupCompleted) {
    // Continuous Setup Experience, Phase 6 (docs/continuous-setup-experience-
    // implementation-plan.md) — the graduation signal. Never venues.setup_
    // completed itself: that column stays the legacy wizard's alone (see
    // lib/setup-hub/service.ts's own header comment) — this venue can be
    // fully graduated via Setup Hub and setup_completed will still read
    // false forever. readyToInviteCouples is the deliberate, reversible
    // owner action (§B) that lets a Setup-Hub-only venue reach the rest of
    // the app without ever touching that column.
    const ready = await isVenueReadyToInviteCouples(venue.id);
    if (!ready) {
      const vendorUser = await getVendorUser();
      if (vendorUser) redirect("/vendor/dashboard");
      // Allow Setup Hub plus the destinations its stages actually link to
      // (Settings, Library, Help — including Import / Migration Center).
      // Operational areas (dashboard, leads, clients, …) still bounce here
      // until Ready to Invite Couples. See lib/setup-hub/pre-graduation-paths.ts.
      const pathname = (await headers()).get("x-pathname") ?? "";
      if (!isPreGraduationAllowedPath(pathname)) {
        redirect("/setup-hub");
      }
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
