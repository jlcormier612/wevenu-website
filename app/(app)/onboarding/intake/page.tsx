import { redirect } from "next/navigation";

import { SelfSetupIntakeClient } from "@/components/onboarding/self-setup-intake-client";
import { getIntakeForVenue } from "@/lib/onboarding/intake-service";
import { getCurrentVenue } from "@/lib/venue/service";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SelfSetupIntakePage() {
  if (!isSupabaseConfigured) redirect("/login");
  const venue = await getCurrentVenue();
  if (!venue) redirect("/login");

  const existing = await getIntakeForVenue(venue.id);
  if (existing?.submittedAt) {
    redirect("/setup-hub");
  }

  const admin = createAdminClient();
  const { data: enrollment } = await admin
    .from("venue_enrollments")
    .select("venue_name")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="px-4 py-8">
      <SelfSetupIntakeClient
        prefill={{
          venueName: enrollment?.venue_name || venue.name,
          // Do not prefill purchaser name/email into venue-contact fields.
          contactPhone: venue.phone || undefined,
          addressLine1: venue.addressLine1 || undefined,
          city: venue.city || undefined,
          stateRegion: venue.stateRegion || undefined,
          postalCode: venue.postalCode || undefined,
        }}
      />
    </div>
  );
}
