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
import type {
  Venue,
  VenueSetupErrors,
  VenueSetupInput,
} from "@/lib/venue/types";
import { validateStep, validateVenueSetup } from "@/lib/venue/validation";

export type SubmitSetupResult =
  | { ok: true; venueId: string }
  | { ok: false; errors: VenueSetupErrors; message?: string };

/** Result type returned by each settings section save. */
export type SaveSectionResult =
  | { ok: true }
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

/**
 * The current user's role on their venue ('owner' | 'manager' | 'coordinator'
 * | 'staff'), or null if none. Mirrors the `current_user_role()` SQL helper
 * (same source of truth used by RLS) — server actions call this for early,
 * good-error-message rejections; RLS is the backstop if this check is ever
 * bypassed or forgotten. See docs/trust-risk-register.md TR-G1.
 */
export async function getCurrentUserRole(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("current_user_role");
  return (data as string | null) ?? null;
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
    try {
      const { seedStarterInventory } = await import("@/lib/inventory/service");
      await seedStarterInventory(venueId);
    } catch (seedError) {
      // Non-fatal — a new venue without a seeded starter catalog can still
      // add Inventory by hand; it should never block venue creation itself.
      console.error("Could not seed starter inventory:", seedError);
    }
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

// ---- Settings ---------------------------------------------------------------

/**
 * Shared auth + venue guard for all settings saves. Calls `fn` only if the
 * current user is authenticated and has a venue.
 */
async function withVenue(
  fn: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    venueId: string,
  ) => Promise<SaveSectionResult>,
): Promise<SaveSectionResult> {
  if (!isSupabaseConfigured)
    return { ok: false, errors: {}, message: "Backend not configured." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, errors: {}, message: "Session expired. Please sign in again." };
  const venue = await repository.getVenueForCurrentUser(supabase);
  if (!venue)
    return { ok: false, errors: {}, message: "Venue not found." };
  return fn(supabase, venue.id);
}

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/**
 * Load the venue plus its hours and owner staff record, mapped to
 * VenueSetupInput so the settings form can reuse the wizard step components.
 */
export async function getVenueSettings(): Promise<{
  input: VenueSetupInput;
  venueId: string;
} | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const details = await repository.getVenueFullDetails(supabase);
  if (!details) return null;
  const { venue, hours, ownerName, ownerTitle, ownerEmail } = details;
  const input: VenueSetupInput = {
    name: venue.name,
    businessName: venue.businessName ?? "",
    email: venue.email ?? "",
    phone: venue.phone ?? "",
    website: venue.website ?? "",
    addressLine1: venue.addressLine1 ?? "",
    addressLine2: venue.addressLine2 ?? "",
    city: venue.city ?? "",
    stateRegion: venue.stateRegion ?? "",
    postalCode: venue.postalCode ?? "",
    country: venue.country ?? "",
    venueType: venue.venueType ?? "",
    capacity: venue.capacity != null ? String(venue.capacity) : "",
    timezone: venue.timezone,
    businessHours: hours,
    logoUrl: venue.logoUrl ?? "",
    primaryColor: venue.primaryColor,
    secondaryColor: venue.secondaryColor,
    accentColor: venue.accentColor ?? "#B8AEA1",
    neutralColor: venue.neutralColor ?? "#F7F5F1",
    ownerFullName: ownerName,
    ownerEmail: ownerEmail || venue.email || "",
    ownerTitle: ownerTitle || "Owner",
    currency: venue.currency,
    weekStartsOn: venue.weekStartsOn,
    stripeOnboardingStatus: venue.stripeOnboardingStatus,
  };
  return { input, venueId: venue.id };
}

/** Save: venue name, business name, contact details, and address. */
export async function saveVenueInfoSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("venue-info", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.updateVenueFields(supabase, venueId, {
      name: input.name.trim(),
      business_name: input.businessName.trim() || null,
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      website: normalizeUrl(input.website) || null,
      address_line1: input.addressLine1.trim() || null,
      address_line2: input.addressLine2.trim() || null,
      city: input.city.trim() || null,
      state_region: input.stateRegion.trim() || null,
      postal_code: input.postalCode.trim() || null,
      country: input.country.trim() || null,
    });
    return { ok: true };
  });
}

/** Save: venue type, capacity, time zone. */
export async function saveVenueProfileSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("venue-details", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.updateVenueFields(supabase, venueId, {
      venue_type: input.venueType || null,
      capacity: input.capacity.trim() ? parseInt(input.capacity, 10) : null,
      timezone: input.timezone,
    });
    return { ok: true };
  });
}

/** Save: all seven business-hours rows via upsert. */
export async function saveBusinessHoursSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("business-hours", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.upsertBusinessHours(supabase, venueId, input.businessHours);
    return { ok: true };
  });
}

/** Save: logo URL and brand colors. */
export async function saveBrandSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("brand", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await repository.updateVenueFields(supabase, venueId, {
      logo_url: input.logoUrl.trim() || null,
      primary_color: input.primaryColor,
      secondary_color: input.secondaryColor,
      accent_color: input.accentColor,
      neutral_color: input.neutralColor,
    });
    return { ok: true };
  });
}

/** Save: owner name/title/email and general settings (currency, week start). */
export async function saveOwnerSection(
  input: VenueSetupInput,
): Promise<SaveSectionResult> {
  const errors = validateStep("owner", input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return withVenue(async (supabase, venueId) => {
    await Promise.all([
      repository.updateOwnerStaff(supabase, venueId, {
        full_name: input.ownerFullName.trim(),
        title: input.ownerTitle.trim() || null,
        email: input.ownerEmail.trim() || null,
      }),
      repository.updateVenueFields(supabase, venueId, {
        currency: input.currency,
        week_starts_on: input.weekStartsOn,
      }),
    ]);
    return { ok: true };
  });
}

/** Permanently hides the Getting Started card for this venue. */
export async function dismissOnboarding(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, {
    onboarding_dismissed: true,
  });
}

/** Update the venue logo URL (or clear it when url is null). */
export async function updateVenueLogo(url: string | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, { logo_url: url ?? null });
}

/** Store a confirmed Stripe Connect account. */
export async function connectStripeAccount(accountId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, {
    stripe_account_id: accountId,
    stripe_onboarding_status: "connected",
    stripe_charges_enabled: true,
  });
}

/** Revoke the Stripe Connect account from the venue record. */
export async function disconnectStripeAccount(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const venue = await getCurrentVenue();
  if (!venue) return;
  await repository.updateVenueFields(supabase, venue.id, {
    stripe_account_id: null,
    stripe_onboarding_status: "not_started",
    stripe_charges_enabled: false,
  });
}
