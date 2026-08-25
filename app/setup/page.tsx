import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/setup/setup-wizard";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = {
  title: "Set up your venue",
};

// Redirects based on isSupabaseConfigured before touching a dynamic API —
// without this, Next.js can statically prerender that redirect at build
// time and cache it indefinitely, serving it to every request regardless
// of actual session state.
export const dynamic = "force-dynamic";

/**
 * Venue Setup entry. Requires an authenticated user (defense in depth
 * alongside the proxy). If a venue has already completed setup, the
 * workspace exists — send the user there instead of re-running setup.
 *
 * Financial/accounting setup (QuickBooks/Stripe connect) is not part of
 * this wizard — those integrations live in Settings, reachable once the
 * venue has finished initial setup.
 */
export default async function SetupPage() {
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

  if (venue?.setupCompleted) {
    redirect("/dashboard");
  }

  // A venue can also graduate via Setup Hub (readyToInviteCouples) without
  // this legacy column ever being set — see app/(app)/layout.tsx's own
  // gate for the full explanation. Direct navigation here shouldn't
  // resurface the old wizard for an already-graduated venue.
  if (venue && (await isVenueReadyToInviteCouples(venue.id))) {
    redirect("/dashboard");
  }

  // Activation already created the venues row (setup_completed stays false).
  // Setup Hub is the first-time experience for that venue; resuming the
  // legacy wizard here would put "You're X% set up" / "ready to welcome
  // its next couple" language back in the path Setup Hub replaced.
  if (venue) {
    redirect("/setup-hub");
  }

  return <SetupWizard ownerEmail={user.email ?? ""} />;
}
