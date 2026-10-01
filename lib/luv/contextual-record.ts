/**
 * Load L3 contextual observations for the record currently being viewed.
 * Reuses the shared Notice engine — no second intelligence path.
 * Passes the viewed record as a scope so venue-wide Dashboard work does
 * not block Client Workspace / lead / contract initial render.
 */

import { createClient } from "@/integrations/supabase/server";
import {
  filterObservationsForRecord,
} from "@/lib/luv/contextual-signals";
import { getLuvObservations } from "@/lib/luv/observations";
import type { LuvObservation } from "@/lib/luv/types";
import { venueToday } from "@/lib/venue/timezone";

export async function getContextualObservationsForRecord(
  venueId: string,
  venueTimezone: string | null | undefined,
  record: {
    leadId?: string;
    eventId?: string;
    contractId?: string;
    contractIds?: readonly string[];
    clientId?: string;
    invoiceId?: string;
  },
): Promise<LuvObservation[]> {
  const supabase = await createClient();
  const today = venueToday(venueTimezone ?? null);
  const all = await getLuvObservations(supabase, venueId, today, undefined, record).catch(() => [] as LuvObservation[]);
  return filterObservationsForRecord(all, record);
}
