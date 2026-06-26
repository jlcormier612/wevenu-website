/**
 * Venue application service.
 *
 * Orchestrates the use cases that the UI and route gating depend on:
 * authentication, business-logic validation, and persistence via the
 * repository. Components and server actions call into here — never into the
 * repository or Supabase directly. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repository from "@/lib/venue/repository";
import type { Venue, VenueSetupErrors, VenueSetupInput } from "@/lib/venue/types";
import { validateVenueSetup } from "@/lib/venue/validation";

export type SubmitSetupResult =
  | { ok: true; venueId: string }
  | { ok: false; errors: VenueSetupErrors; message?: string };

/**
 * The current user's venue, or null if none exists / not authenticated /
 * Supabase not configured. Used by route gating and the workspace.
 */
export async function getCurrentVenue(): Promise<Venue | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return repository.getVenueForCurrentUser(supabase);
}

/** True when the current user has a venue with setup completed. */
export async function hasCompletedVenueSetup(): Promise<boolean> {
  const venue = await getCurrentVenue();
  return Boolean(venue?.setupCompleted);
}

/**
 * Validate and persist the Venue Setup wizard. Validation runs here
 * authoritatively (regardless of any client-side checks) before writing.
 */
export async function submitVenueSetup(
  input: VenueSetupInput,
): Promise<SubmitSetupResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      errors: {},
      message: "The data backend is not configured in this environment.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      errors: {},
      message: "Your session has expired. Please sign in again.",
    };
  }

  const errors = validateVenueSetup(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // Idempotency: if a completed venue already exists, treat as success.
  const existing = await repository.getVenueForCurrentUser(supabase);
  if (existing?.setupCompleted) {
    return { ok: true, venueId: existing.id };
  }

  try {
    const venueId = await repository.insertVenueSetup(supabase, input);
    return { ok: true, venueId };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "23505") {
      // Unique violation — a venue already exists for this owner.
      const venue = await repository.getVenueForCurrentUser(supabase);
      if (venue) return { ok: true, venueId: venue.id };
    }
    const message =
      error instanceof Error
        ? error.message
        : "We couldn't save your venue. Please try again.";
    return { ok: false, errors: {}, message };
  }
}
