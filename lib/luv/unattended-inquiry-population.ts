/**
 * Server entry for the P-A1 Leads destination population.
 * Recomputes the shared evaluator — does not trust stored metadata.lead_ids.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { loadQualifyingUnattendedInquiryLeadIds } from "@/lib/luv/unattended-inquiry-contact";
import { getCurrentVenue } from "@/lib/venue/service";

export async function getUnattendedInquiryLeadIdsForCurrentVenue(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  return loadQualifyingUnattendedInquiryLeadIds(supabase, venue.id);
}
