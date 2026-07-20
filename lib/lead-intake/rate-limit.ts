/**
 * Layered abuse protection, part 1 — rate limiting.
 *
 * Cheap, no new infrastructure: a sliding-window count against
 * lead_intake_attempts (already written for every attempt regardless of
 * outcome). Only applied to public-facing trust tiers (direct, email_parsed)
 * — authenticated/manual/import callers are already venue-session-gated.
 *
 * This is the escalation signal Turnstile verification (turnstile.ts) also
 * reads — once a caller is close to this threshold, a Turnstile token
 * becomes required rather than optional.
 */
import type { AnyDbClient } from "@/lib/lead-intake/types";

const PER_IP_VENUE_WINDOW_MINUTES = 10;
const PER_IP_VENUE_MAX = 5;

const VENUE_WIDE_WINDOW_MINUTES = 60;
const VENUE_WIDE_MAX = 50;

export type RateLimitCheck = { withinLimit: true } | { withinLimit: false; reason: string };

export async function checkRateLimit(
  supabase: AnyDbClient,
  params: { venueId: string; ipAddress: string | null },
): Promise<RateLimitCheck> {
  if (params.ipAddress) {
    const since = new Date(Date.now() - PER_IP_VENUE_WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await supabase
      .from("lead_intake_attempts")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", params.venueId)
      .eq("ip_address", params.ipAddress)
      .gte("created_at", since);
    if ((count ?? 0) >= PER_IP_VENUE_MAX) {
      return { withinLimit: false, reason: "Too many submissions from this address. Please try again later." };
    }
  }

  const venueSince = new Date(Date.now() - VENUE_WIDE_WINDOW_MINUTES * 60_000).toISOString();
  const { count: venueCount } = await supabase
    .from("lead_intake_attempts")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", params.venueId)
    .gte("created_at", venueSince);
  if ((venueCount ?? 0) >= VENUE_WIDE_MAX) {
    return { withinLimit: false, reason: "This form is receiving an unusually high volume right now. Please try again shortly." };
  }

  return { withinLimit: true };
}

/** Escalation signal for Turnstile (turnstile.ts) — true once a caller is close enough to the limit that a challenge should become mandatory rather than optional. */
export async function isNearRateLimit(
  supabase: AnyDbClient,
  params: { venueId: string; ipAddress: string | null },
): Promise<boolean> {
  if (!params.ipAddress) return false;
  const since = new Date(Date.now() - PER_IP_VENUE_WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await supabase
    .from("lead_intake_attempts")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", params.venueId)
    .eq("ip_address", params.ipAddress)
    .gte("created_at", since);
  return (count ?? 0) >= Math.ceil(PER_IP_VENUE_MAX / 2);
}
