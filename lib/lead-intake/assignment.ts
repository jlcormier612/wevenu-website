/**
 * Assignment Hook — the one, explicit extension point for future lead
 * routing (round-robin, load-based, territory rules, a default owner).
 * Deliberately out of scope for this initiative; this stub exists so that
 * when routing is built, it plugs in here — no Source Adapter or pipeline
 * stage before it ever needs to change.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveLeadOwner(supabase: AnyDbClient, leadId: string, venueId: string): Promise<string | null> {
  return null;
}
