import { redirect } from "next/navigation";

import { isVenueReadyToInviteCouples } from "@/lib/setup-hub/service";
import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/integrations/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Legacy /setup route — thin redirect only.
 * The SetupWizard is no longer a user-facing onboarding experience.
 */
export default async function SetupRedirectPage() {
  if (!isSupabaseConfigured) {
    redirect("/login");
  }

  const supabase = await createClient("venue");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const venue = await getCurrentVenue();
  if (!venue) {
    redirect("/onboarding/intake");
  }

  const ready = await isVenueReadyToInviteCouples(venue.id);
  if (ready) {
    redirect("/dashboard");
  }

  redirect("/setup-hub");
}
