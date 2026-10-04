/**
 * Live facts for Setup Concierge. Current venue only.
 * Setup Hub click acknowledgements and activation telemetry are not inputs.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { facebookUiState } from "@/lib/facebook/ui-state";
import { getConnection, getLeadForms } from "@/lib/facebook/repository";
import { selectSetupConciergeEntry } from "@/lib/setup-concierge/select";
import type { SetupConciergeEntry, VenueSetupSnapshot } from "@/lib/setup-concierge/types";
import { getTextingSetupBundle } from "@/lib/texting-registration/service";
import { getCurrentVenue } from "@/lib/venue/service";
import type { StripeOnboardingStatus } from "@/lib/venue/types";

export async function loadSetupConciergeEntry(): Promise<SetupConciergeEntry | null> {
  const snapshot = await loadVenueSetupSnapshot();
  if (!snapshot) return null;
  return selectSetupConciergeEntry(snapshot);
}

export async function loadVenueSetupSnapshot(): Promise<VenueSetupSnapshot | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const venueId = venue.id;

  const [
    venueRow,
    inquiryLeads,
    hubState,
    packages,
    facebookConnection,
    facebookForms,
    texting,
  ] = await Promise.all([
    supabase
      .from("venues")
      .select("name, email, phone, address_line1, embed_key, stripe_charges_enabled, stripe_onboarding_status")
      .eq("id", venueId)
      .maybeSingle<{
        name: string | null;
        email: string | null;
        phone: string | null;
        address_line1: string | null;
        embed_key: string | null;
        stripe_charges_enabled: boolean | null;
        stripe_onboarding_status: StripeOnboardingStatus | null;
      }>(),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .in("source", ["website", "website_form"]),
    supabase
      .from("venue_setup_hub_state")
      .select("lead_capture_path, financials_reviewed_at, ready_to_invite_couples")
      .eq("venue_id", venueId)
      .maybeSingle<{
        lead_capture_path: "automated" | "manual_external" | null;
        financials_reviewed_at: string | null;
        ready_to_invite_couples: boolean | null;
      }>(),
    supabase
      .from("packages")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("is_active", true)
      .is("source_master_key", null),
    getConnection(supabase, venueId),
    getLeadForms(supabase, venueId),
    getTextingSetupBundle(),
  ]);

  const row = venueRow.data;
  if (venueRow.error || !row) return null;

  const filled = (value: string | null | undefined) => Boolean(value && value.trim());
  const path = hubState.data?.lead_capture_path;
  const leadCapturePath = path === "automated" || path === "manual_external" ? path : null;
  const onboarding = row.stripe_onboarding_status;
  const stripeOnboardingStatus: StripeOnboardingStatus =
    onboarding === "connected" || onboarding === "pending" ? onboarding : "not_started";

  return {
    readyToInviteCouples: hubState.data?.ready_to_invite_couples === true,
    hasName: filled(row.name),
    hasEmail: filled(row.email),
    hasPhone: filled(row.phone),
    hasAddress: filled(row.address_line1),
    authoredActivePackageCount: packages.error ? null : (packages.count ?? 0),
    leadCapturePath: hubState.error ? null : leadCapturePath,
    leadCapturePathKnown: !hubState.error,
    inquiryFormReady: filled(row.embed_key),
    inquiryFormReceivedLead: inquiryLeads.error ? null : (inquiryLeads.count ?? 0) > 0,
    stripeChargesEnabled: row.stripe_charges_enabled === true,
    stripeOnboardingStatus,
    financialsReviewedAt: hubState.error ? null : (hubState.data?.financials_reviewed_at ?? null),
    facebookUiState: facebookUiState(facebookConnection, facebookForms),
    textingPhase: texting?.phase ?? "not_started",
    textingSmsReady: texting?.smsReady === true,
    textingCanEdit: texting?.canEdit === true,
  };
}
