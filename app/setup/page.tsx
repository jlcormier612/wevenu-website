import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetupWizard } from "@/components/setup/setup-wizard";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export const metadata: Metadata = {
  title: "Set up your venue",
};

/**
 * Venue Setup entry. Requires an authenticated user (defense in depth alongside
 * the proxy). If a venue has already been created, the workspace exists — send
 * the user there instead of re-running setup.
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

  return <SetupWizard ownerEmail={user.email ?? ""} />;
}
