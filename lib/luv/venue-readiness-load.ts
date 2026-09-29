/**
 * Loads Venue Readiness facts for the signed-in venue only.
 *
 * getCurrentVenue() is the active-venue mechanism. Every query is filtered
 * by that venue id. A caller cannot point this at another venue.
 *
 * Unknown query results are null, and the assessor skips those signals
 * rather than inventing a gap.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { facebookIsDelivering, facebookUiState } from "@/lib/facebook/ui-state";
import { getConnection, getLeadForms } from "@/lib/facebook/repository";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  assessVenueReadiness,
  type FacebookReadiness,
  type VenueReadinessAssessment,
  type VenueReadinessFacts,
} from "@/lib/luv/venue-readiness";

type CountResult = { count: number | null; error: { message: string } | null };

function countOrUnknown(result: CountResult): number | null {
  if (result.error) return null;
  return result.count ?? 0;
}

export async function loadVenueReadiness(): Promise<VenueReadinessAssessment | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const facts = await loadVenueReadinessFacts(venue.id);
  if (!facts) return null;
  return assessVenueReadiness(facts);
}

async function loadVenueReadinessFacts(venueId: string): Promise<VenueReadinessFacts | null> {
  const supabase = await createClient();
  const venueQuery = supabase
    .from("venues")
    .select("name, email, phone, address_line1, logo_url, timezone, embed_key, email_intake_connected_at, tour_scheduling_enabled, stripe_charges_enabled, space_operating_mode")
    .eq("id", venueId)
    .maybeSingle<{
      name: string | null;
      email: string | null;
      phone: string | null;
      address_line1: string | null;
      logo_url: string | null;
      timezone: string | null;
      embed_key: string | null;
      email_intake_connected_at: string | null;
      tour_scheduling_enabled: boolean | null;
      stripe_charges_enabled: boolean | null;
      space_operating_mode: string | null;
    }>();

  const [
    venueRow,
    inquiryLeads,
    emailAccepted,
    hubState,
    tourWindows,
    packages,
    contracts,
    messages,
    playbooks,
    spaces,
    inventoryRows,
    facebookConnection,
    facebookForms,
  ] = await Promise.all([
    venueQuery,
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("source", "website_form"),
    supabase.from("lead_intake_attempts").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("source", "email_parsed_generic").eq("status", "accepted"),
    supabase.from("venue_setup_hub_state").select("lead_capture_path").eq("venue_id", venueId)
      .maybeSingle<{ lead_capture_path: "automated" | "manual_external" | null }>(),
    supabase.from("tour_availability_windows").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
    supabase.from("packages").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_active", true).is("source_master_key", null),
    supabase.from("contract_templates").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false).is("source_master_key", null),
    supabase.from("message_templates").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false).is("source_master_key", null),
    supabase.from("playbook_templates").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("is_archived", false),
    supabase.from("venue_spaces").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
    supabase.from("inventory_items").select("id, inventory_categories(source_master_key)")
      .eq("venue_id", venueId).eq("is_archived", false),
    getConnection(supabase, venueId),
    getLeadForms(supabase, venueId),
  ]);

  const row = venueRow.data;
  if (venueRow.error || !row) return null;

  const path = hubState.data?.lead_capture_path;
  const leadCapturePath = path === "automated" || path === "manual_external" ? path : null;

  let facebook: FacebookReadiness = "absent";
  if (facebookConnection || facebookForms.length > 0) {
    const state = facebookUiState(facebookConnection, facebookForms);
    facebook = state === "not_connected"
      ? "absent"
      : facebookIsDelivering(facebookConnection, facebookForms)
        ? "delivering"
        : "incomplete";
  }

  type InventoryRow = { id: string; inventory_categories: { source_master_key: string | null } | { source_master_key: string | null }[] | null };
  const inventoryUnknown = Boolean(inventoryRows.error);
  const inventoryData = (inventoryRows.data ?? []) as unknown as InventoryRow[];
  const authoredInventoryCount = inventoryUnknown
    ? null
    : inventoryData.filter((item) => {
        const category = Array.isArray(item.inventory_categories) ? item.inventory_categories[0] : item.inventory_categories;
        return !category?.source_master_key;
      }).length;

  const filled = (value: string | null | undefined) => Boolean(value && value.trim());

  return {
    hasName: filled(row.name),
    hasEmail: filled(row.email),
    hasPhone: filled(row.phone),
    hasAddress: filled(row.address_line1),
    hasLogo: filled(row.logo_url),
    hasTimezone: filled(row.timezone),
    inquiryFormReady: filled(row.embed_key),
    inquiryFormReceivedLead: inquiryLeads.error ? null : (inquiryLeads.count ?? 0) > 0,
    emailIntakeEnabled: Boolean(row.email_intake_connected_at),
    emailIntakeAcceptedLead: emailAccepted.error ? null : (emailAccepted.count ?? 0) > 0,
    facebook,
    leadCapturePath: hubState.error ? null : leadCapturePath,
    leadCapturePathKnown: !hubState.error,
    tourSchedulingEnabled: row.tour_scheduling_enabled === true,
    tourWindowCount: countOrUnknown(tourWindows),
    authoredPackageCount: countOrUnknown(packages),
    authoredContractTemplateCount: countOrUnknown(contracts),
    authoredMessageTemplateCount: countOrUnknown(messages),
    playbookCount: countOrUnknown(playbooks),
    authoredInventoryCount,
    stripeChargesEnabled: row.stripe_charges_enabled === true,
    spaceOperatingMode: row.space_operating_mode === "multi" ? "multi" : "single",
    spaceCount: countOrUnknown(spaces),
  };
}
