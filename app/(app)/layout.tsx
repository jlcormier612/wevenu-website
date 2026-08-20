import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordStaffActivity } from "@/lib/activation/service";

// Reads cookies via createClient()/redirects based on isSupabaseConfigured
// before any dynamic API call — without this, Next.js can statically
// prerender the redirect at build time (when Supabase env vars may be
// unavailable) and cache it indefinitely, serving a stale redirect to
// every real request regardless of actual session state.
export const dynamic = "force-dynamic";

/**
 * Protected layout for the venue workspace. Uses the venue auth cookie jar
 * only — vendor/client sessions in the same browser do not satisfy this gate
 * and are never overwritten by venue routing.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient("venue");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const venue = await getCurrentVenue();
  if (!venue) {
    // No venue row — venue onboarding. Vendor/client sessions are separate
    // cookie jars and must not be treated as substitutes here.
    redirect("/setup");
  }
  if (!venue.setupCompleted) {
    const ready = await isVenueReadyToInviteCouples(venue.id);
    if (!ready) {
      // /setup-hub itself lives inside this same (app) group, so without this
      // check every request for it would re-enter this branch and redirect
      // to itself in a loop. Everything else under (app) still bounces to it.
      const pathname = (await headers()).get("x-pathname") ?? "";
      if (!pathname.startsWith("/setup-hub")) {
        redirect("/setup-hub");
      }
    }
  }

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
