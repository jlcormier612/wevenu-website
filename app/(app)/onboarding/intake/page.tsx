import { redirect } from "next/navigation";

import { getCurrentVenue } from "@/lib/venue/service";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Legacy Self-Setup intake route.
 * Provisioned venue owners continue in Milestone 02 → Your venue & brand.
 * Does not delete historical venue_onboarding_intake rows.
 */
export default async function SelfSetupIntakePage() {
  if (!isSupabaseConfigured) redirect("/login");
  const venue = await getCurrentVenue();
  if (!venue) redirect("/login");

  redirect("/settings/business?from=setup-hub");
}
