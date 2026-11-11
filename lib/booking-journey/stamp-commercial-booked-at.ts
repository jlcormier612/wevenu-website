/**
 * Commercial milestones are business facts.
 * They do not move a relationship to Booked.
 * The venue's pipeline decision is the only booking decision.
 */

import type { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type CommercialStampResult = {
  newlyBooked: boolean;
  clientId: string;
  eventId: string;
};

export async function maybeStampCommercialBookedAt(
  _supabase: DbClient,
  _venueId: string,
  _opts: { clientId: string; eventId?: string | null },
): Promise<CommercialStampResult | null> {
  return null;
}
